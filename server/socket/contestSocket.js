import Contest from '../models/Contest.model.js';

/*
  In-memory room store. Contest *documents* persist in MongoDB (created via
  the REST endpoint), but the live, fast-moving state of an active room
  (who's connected, ready status, live scores, countdown/end timers) lives
  here — this is the same tradeoff as the presence-tracking Map in
  server.js: fine for a single server instance, would need a shared store
  (Redis, etc.) to work across multiple instances behind a load balancer.
*/
const rooms = new Map();

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const COUNTDOWN_MS = 3000;
const SCORE_UPDATE_MIN_INTERVAL_MS = 400; // basic rate limit on client-reported updates

const contestChannel = (roomCode) => `contest:${roomCode}`;

const getPublicParticipants = (room) =>
  Array.from(room.participants.entries()).map(([userId, p]) => ({
    userId,
    username: p.username,
    isReady: p.isReady,
    isHost: userId === room.hostId,
    connected: p.socketIds.size > 0,
    score: p.score,
    packetsAcked: p.packetsAcked,
    lossCount: p.lossCount
  }));

const broadcastLobby = (io, room) => {
  io.to(contestChannel(room.roomCode)).emit('lobby_update', {
    roomCode: room.roomCode,
    status: room.status,
    participants: getPublicParticipants(room)
  });
};

const broadcastLeaderboard = (io, room) => {
  const ranked = getPublicParticipants(room)
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({ ...p, rank: index + 1 }));

  io.to(contestChannel(room.roomCode)).emit('leaderboard_update', {
    roomCode: room.roomCode,
    leaderboard: ranked,
    serverTime: Date.now()
  });
};

// Server-side authority on when the match ends — this is the actual
// anti-cheat guarantee here: no client can extend its own play time or fake
// when the match is over, regardless of what it reports via
// update_live_score. What it does NOT protect against is a client lying
// about its own score/packet counts in that event; a stronger version of
// this feature would re-simulate every player's packets server-side instead
// of trusting client-reported numbers. Flagging this clearly rather than
// pretending it's fully cheat-proof.
const finishContest = async (io, room) => {
  if (room.status === 'completed') return;
  room.status = 'completed';

  clearTimeout(room.countdownTimeout);
  clearTimeout(room.endTimeout);

  const ranked = getPublicParticipants(room).sort((a, b) => b.score - a.score);

  try {
    await Contest.findByIdAndUpdate(room.contestId, {
      status: 'completed',
      endedAt: new Date(),
      participants: ranked.map((p, index) => ({
        user: p.userId,
        username: p.username,
        score: p.score,
        packetsAcked: p.packetsAcked,
        lossCount: p.lossCount,
        isReady: p.isReady,
        finalRank: index + 1
      }))
    });
  } catch {
    // Non-fatal — players still get the in-memory final ranking below even
    // if the DB write fails for some reason.
  }

  io.to(contestChannel(room.roomCode)).emit('contest_time_up', {
    roomCode: room.roomCode,
    finalResults: ranked.map((p, index) => ({ ...p, rank: index + 1 }))
  });
};

// Call this once per socket connection (from server.js), same pattern as
// the chat handlers — it just adds contest-specific listeners onto an
// already-authenticated socket.
const registerContestHandlers = (io, socket) => {
  const selfId = socket.data.user.id;
  const selfUsername = socket.data.user.username;

  socket.on('join_contest_room', async ({ roomCode } = {}) => {
    try {
      const code = String(roomCode || '').toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        return socket.emit('contest_error', 'Contest room not found.');
      }

      let participant = room.participants.get(selfId);

      if (!participant) {
        if (room.status !== 'waiting') {
          return socket.emit('contest_error', 'This contest has already started.');
        }

        if (room.participants.size >= room.config.maxPlayers) {
          return socket.emit('contest_error', 'This contest room is full.');
        }

        participant = {
          username: selfUsername,
          socketIds: new Set(),
          isReady: false,
          score: 0,
          packetsAcked: 0,
          lossCount: 0,
          lastScoreUpdateAt: 0
        };

        room.participants.set(selfId, participant);
      }

      participant.socketIds.add(socket.id);
      socket.join(contestChannel(code));
      socket.data.contestRoomCode = code;

      // Include the authoritative timestamps so a client joining or
      // reconnecting mid-countdown or mid-match can resync its own local
      // timer immediately, instead of only relying on catching the
      // original one-time countdown/started broadcast.
      socket.emit('joined_contest', {
        roomCode: code,
        title: room.title,
        config: room.config,
        status: room.status,
        isHost: room.hostId === selfId,
        countdownStartAt: room.countdownStartAt || null,
        startedAt: room.startedAt || null,
        endsAt: room.endsAt || null
      });

      broadcastLobby(io, room);
    } catch {
      socket.emit('contest_error', 'Could not join this contest.');
    }
  });

  socket.on('player_ready_toggle', () => {
    const room = rooms.get(socket.data.contestRoomCode);
    if (!room || room.status !== 'waiting') return;

    const participant = room.participants.get(selfId);
    if (!participant) return;

    participant.isReady = !participant.isReady;
    broadcastLobby(io, room);
  });

  socket.on('start_contest_timer', () => {
    const room = rooms.get(socket.data.contestRoomCode);
    if (!room) return;

    if (room.hostId !== selfId) {
      return socket.emit('contest_error', 'Only the host can start the contest.');
    }

    if (room.status !== 'waiting') return;

    if (room.participants.size < 2) {
      return socket.emit('contest_error', 'At least 2 players are required to start.');
    }

    room.status = 'countdown';
    room.countdownStartAt = Date.now() + COUNTDOWN_MS;

    io.to(contestChannel(room.roomCode)).emit('contest_countdown', {
      startAt: room.countdownStartAt
    });
    broadcastLobby(io, room);

    room.countdownTimeout = setTimeout(() => {
      room.status = 'in_progress';
      room.startedAt = Date.now();
      room.endsAt = Date.now() + room.config.duration * 1000;

      io.to(contestChannel(room.roomCode)).emit('contest_started', {
        roomCode: room.roomCode,
        startedAt: room.startedAt,
        endsAt: room.endsAt,
        config: room.config
      });

      room.endTimeout = setTimeout(
        () => finishContest(io, room),
        room.config.duration * 1000
      );
    }, COUNTDOWN_MS);
  });

  socket.on('update_live_score', ({ score, packetsAcked, lossCount } = {}) => {
    const room = rooms.get(socket.data.contestRoomCode);
    if (!room || room.status !== 'in_progress') return;

    const participant = room.participants.get(selfId);
    if (!participant) return;

    const now = Date.now();
    if (now - participant.lastScoreUpdateAt < SCORE_UPDATE_MIN_INTERVAL_MS) return;
    participant.lastScoreUpdateAt = now;

    if (Number.isFinite(score)) participant.score = score;
    if (Number.isFinite(packetsAcked)) participant.packetsAcked = packetsAcked;
    if (Number.isFinite(lossCount)) participant.lossCount = lossCount;

    broadcastLeaderboard(io, room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.contestRoomCode;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const participant = room.participants.get(selfId);
    if (!participant) return;

    participant.socketIds.delete(socket.id);

    if (room.status === 'waiting') {
      broadcastLobby(io, room);
    }
  });
};

// Called by the REST controller right after a Contest document is created
// in MongoDB, so the in-memory room exists before the host's socket tries
// to join it.
const registerRoomFromContest = (contestDoc) => {
  rooms.set(contestDoc.roomCode, {
    roomCode: contestDoc.roomCode,
    contestId: contestDoc._id.toString(),
    hostId: contestDoc.host.toString(),
    title: contestDoc.title,
    config: contestDoc.config,
    status: 'waiting',
    participants: new Map(),
    countdownTimeout: null,
    endTimeout: null,
    countdownStartAt: null,
    startedAt: null,
    endsAt: null
  });
};

const generateRoomCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from(
      { length: 6 },
      () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');

    // eslint-disable-next-line no-await-in-loop
    if (!rooms.has(code) && !(await Contest.exists({ roomCode: code }))) {
      return code;
    }
  }

  throw new Error('Could not generate a unique room code. Please try again.');
};

export { registerContestHandlers, registerRoomFromContest, generateRoomCode };