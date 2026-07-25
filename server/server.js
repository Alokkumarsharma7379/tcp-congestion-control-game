import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import app from './app.js';
import connectDB from './config/db.js';
import { verifyToken } from './config/jwt.js';
import User from './models/User.model.js';
import Message from './models/Message.model.js';

const { isValidObjectId } = mongoose;

const PORT = process.env.PORT || 5000;
const HISTORY_LIMIT = 50;
const GLOBAL_ROOM = 'global';

// Every authenticated socket auto-joins a room keyed to its own user id.
// Direct messages are delivered by emitting to the RECIPIENT's personal
// room, not by relying on them having a specific conversation open — so a
// DM arrives in real time even if the recipient is on the Global tab (or
// has a different conversation open) when it's sent.
const personalRoomFor = (userId) => `user:${userId}`;

// Never trust a client-supplied room string for direct chats — the room id
// is always derived server-side from the two participants' own ids, sorted
// so it's the same string regardless of who's asking.
const directRoomFor = (userIdA, userIdB) =>
  [String(userIdA), String(userIdB)].sort().join('_');

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    // Matches the Express CORS setup in app.js. In production, prefer
    // locking this down to your actual frontend origin(s) via an env var
    // rather than reflecting any origin.
    origin: true,
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    const payload = verifyToken(token);

    if (!payload?.id) {
      return next(new Error('Invalid authentication token.'));
    }

    const user = await User.findById(payload.id).select('username');

    if (!user) {
      return next(new Error('This session is no longer valid.'));
    }

    // Never trust a client-supplied name/id for chat messages — always use
    // what the server itself resolved from the verified token.
    socket.data.user = {
      id: user._id.toString(),
      username: user.username
    };

    next();
  } catch {
    next(new Error('Authentication failed.'));
  }
});

io.on('connection', (socket) => {
  const selfId = socket.data.user.id;

  // Personal room for DM delivery, joined once per connection regardless of
  // which chat tab is currently open on the client.
  socket.join(personalRoomFor(selfId));

  const resolveRoom = ({ chatType, otherUserId }) => {
    if (chatType === 'direct') {
      if (!otherUserId || !isValidObjectId(otherUserId)) return null;
      if (otherUserId === selfId) return null;
      return directRoomFor(selfId, otherUserId);
    }

    return GLOBAL_ROOM;
  };

  socket.on('join_room', async ({ chatType, otherUserId } = {}) => {
    try {
      const room = resolveRoom({ chatType, otherUserId });

      if (!room) {
        return socket.emit('chat_error', 'Invalid conversation.');
      }

      if (chatType === 'direct' && !(await User.exists({ _id: otherUserId }))) {
        return socket.emit('chat_error', 'That user no longer exists.');
      }

      // Global is a real shared room everyone in it broadcasts to directly.
      // Direct rooms don't need socket.join at all — delivery happens via
      // each participant's personal room instead — but joining is harmless
      // and makes future room-based features easier to add.
      socket.join(room);

      const recentMessages = await Message.find({
        room,
        deletedForUsers: { $ne: selfId }
      })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      socket.emit('room_history', {
        room,
        chatType: chatType === 'direct' ? 'direct' : 'global',
        otherUserId: chatType === 'direct' ? otherUserId : null,
        messages: recentMessages.reverse()
      });
    } catch {
      socket.emit('chat_error', 'Could not load chat history.');
    }
  });

  socket.on('send_message', async ({ chatType, otherUserId, text } = {}) => {
    try {
      const safeText = typeof text === 'string' ? text.trim() : '';
      if (!safeText || safeText.length > 500) return;

      const room = resolveRoom({ chatType, otherUserId });
      if (!room) {
        return socket.emit('chat_error', 'Invalid conversation.');
      }

      if (chatType === 'direct' && !(await User.exists({ _id: otherUserId }))) {
        return socket.emit('chat_error', 'That user no longer exists.');
      }

      const message = await Message.create({
        sender: selfId,
        senderName: socket.data.user.username,
        recipient: chatType === 'direct' ? otherUserId : null,
        chatType: chatType === 'direct' ? 'direct' : 'global',
        room,
        text: safeText
      });

      const payload = {
        _id: message._id,
        sender: message.sender,
        senderName: message.senderName,
        recipient: message.recipient,
        chatType: message.chatType,
        room: message.room,
        text: message.text,
        isDeletedForEveryone: message.isDeletedForEveryone,
        createdAt: message.createdAt
      };

      if (message.chatType === 'direct') {
        io.to(personalRoomFor(selfId)).emit('receive_message', payload);
        io.to(personalRoomFor(otherUserId)).emit('receive_message', payload);
      } else {
        io.to(GLOBAL_ROOM).emit('receive_message', payload);
      }
    } catch {
      socket.emit('chat_error', 'Message could not be sent. Please try again.');
    }
  });

  socket.on('delete_for_me', async ({ messageId } = {}) => {
    try {
      if (!messageId || !isValidObjectId(messageId)) return;

      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { deletedForUsers: selfId } },
        { new: true }
      );

      if (!message) return;

      // Private to the requester only — nobody else's view changes.
      socket.emit('message_deleted_for_me', {
        messageId: message._id,
        room: message.room
      });
    } catch {
      socket.emit('chat_error', 'Could not delete that message.');
    }
  });

  socket.on('delete_for_everyone', async ({ messageId } = {}) => {
    try {
      if (!messageId || !isValidObjectId(messageId)) return;

      const message = await Message.findById(messageId);

      if (!message) return;

      if (String(message.sender) !== selfId) {
        return socket.emit('chat_error', 'You can only delete your own messages for everyone.');
      }

      if (!message.isDeletedForEveryone) {
        message.isDeletedForEveryone = true;
        await message.save();
      }

      const deletedPayload = { messageId: message._id, room: message.room };

      if (message.chatType === 'direct') {
        io.to(personalRoomFor(String(message.sender))).emit('message_deleted', deletedPayload);
        io.to(personalRoomFor(String(message.recipient))).emit('message_deleted', deletedPayload);
      } else {
        io.to(GLOBAL_ROOM).emit('message_deleted', deletedPayload);
      }
    } catch {
      socket.emit('chat_error', 'Could not delete that message.');
    }
  });
});

const startServer = async () => {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server.');
  console.error(error.message);

  process.exit(1);
});