import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/http';
import { getContest } from '../../api/contestApi';

import '../../styles/codeforces.css';

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || undefined;

function ContestLobbyPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const [title, setTitle] = useState('');
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('waiting');
  const [participants, setParticipants] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [copyLabel, setCopyLabel] = useState('Copy Code');

  const socketRef = useRef(null);

  /* hydrate basic contest info over REST first, in case the socket join
     response is briefly delayed */
  useEffect(() => {
    let cancelled = false;

    getContest(roomCode)
      .then((response) => {
        if (cancelled) return;
        setTitle(response.data.contest.title);
        setConfig(response.data.contest.config);
        setStatus(response.data.contest.status);
      })
      .catch(() => {
        if (!cancelled) setError('This contest could not be found.');
      });

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_contest_room', { roomCode });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setError('Could not connect to the contest server.');
    });

    socket.on('joined_contest', (payload) => {
      setTitle(payload.title);
      setConfig(payload.config);
      setStatus(payload.status);
      setIsHost(payload.isHost);

      // If we joined (or reconnected) mid-countdown or mid-match, skip
      // straight to the game canvas — it resyncs its own timer from the
      // authoritative startedAt/endsAt/countdownStartAt values.
      if (payload.status === 'countdown' || payload.status === 'in_progress') {
        navigate(`/contest/${roomCode}/play`, { replace: true });
      }
    });

    socket.on('lobby_update', (payload) => {
      setStatus(payload.status);
      setParticipants(payload.participants);
    });

    socket.on('contest_countdown', () => {
      navigate(`/contest/${roomCode}/play`);
    });

    socket.on('contest_error', (message) => setError(message));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('joined_contest');
      socket.off('lobby_update');
      socket.off('contest_countdown');
      socket.off('contest_error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, roomCode, navigate]);

  const handleToggleReady = () => {
    socketRef.current?.emit('player_ready_toggle');
  };

  const handleStart = () => {
    socketRef.current?.emit('start_contest_timer');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy Code'), 1500);
    } catch {
      setCopyLabel('Copy failed');
    }
  };

  const self = participants.find((p) => String(p.userId) === String(user?._id));
  const readyCount = participants.filter((p) => p.isReady).length;
  const canStart = isHost && status === 'waiting' && participants.length >= 2;

  return (
    <main className="content">
      <section className="panel">
        <div className="panel-header">▶ Contest Lobby {title ? `— ${title}` : ''}</div>
        <div className="panel-body">
          <div className="lobby-room-code-row">
            <span>Room Code:</span>
            <span className="lobby-room-code">{roomCode}</span>
            <button type="button" className="cf-btn" onClick={handleCopyCode}>
              {copyLabel}
            </button>
          </div>

          {!connected && <p className="muted-text">Connecting to lobby...</p>}
          {error && <div className="form-error">{error}</div>}

          {config && (
            <div className="lobby-config-summary">
              <span>Duration: {config.duration}s</span>
              <span>Capacity: {config.capacity}</span>
              <span>Queue: {config.queueSize}</span>
              <span>Loss: {(config.lossProbability * 100).toFixed(1)}%</span>
              <span>Initial CWND: {config.initialCwnd}</span>
              <span>Max Players: {config.maxPlayers}</span>
            </div>
          )}

          <table className="cf-table lobby-participant-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.userId}>
                  <td>
                    {p.username}
                    {p.isHost && <span className="lobby-host-tag">HOST</span>}
                  </td>
                  <td className={p.isReady ? 'status-ok' : 'muted-status'}>
                    {p.isReady ? 'Ready' : 'Not ready'}
                    {!p.connected && ' (disconnected)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="muted-text">
            {readyCount} / {participants.length} players ready
          </p>

          <div className="lobby-actions">
            {!isHost && (
              <button type="button" className="cf-btn primary" onClick={handleToggleReady}>
                {self?.isReady ? 'Not Ready' : "I'm Ready"}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                className="cf-btn primary"
                onClick={handleStart}
                disabled={!canStart}
                title={!canStart ? 'Need at least 2 players to start' : ''}
              >
                ▶ Start Contest
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ContestLobbyPage;