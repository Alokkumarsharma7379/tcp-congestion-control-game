import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';

import app from './app.js';
import connectDB from './config/db.js';
import { verifyToken } from './config/jwt.js';
import User from './models/User.model.js';
import Message from './models/Message.model.js';

const PORT = process.env.PORT || 5000;
const HISTORY_LIMIT = 50;
const DEFAULT_ROOM = 'global';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    // Matches the Express CORS setup in app.js. In production, prefer
    // locking this down to your actual frontend origin(s) via an env var
    // rather than reflecting any origin — see the note at the bottom of
    // this file.
    origin: true,
    credentials: true
  }
});

// Every socket connection must present a valid JWT (the same one used for
// HTTP requests) before it's allowed to do anything else. This runs once
// per connection attempt, before any event listeners are registered.
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
  socket.on('join_room', async (room) => {
    try {
      const safeRoom = typeof room === 'string' && room.trim() ? room.trim() : DEFAULT_ROOM;

      // Leave any previously-joined rooms (besides the private per-socket
      // room Socket.IO creates automatically) before joining the new one.
      Array.from(socket.rooms)
        .filter((joinedRoom) => joinedRoom !== socket.id)
        .forEach((joinedRoom) => socket.leave(joinedRoom));

      socket.join(safeRoom);

      const recentMessages = await Message.find({ room: safeRoom })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      socket.emit('room_history', {
        room: safeRoom,
        messages: recentMessages.reverse()
      });
    } catch (error) {
      socket.emit('chat_error', 'Could not load chat history.');
    }
  });

  socket.on('send_message', async ({ room, text } = {}) => {
    try {
      const safeRoom = typeof room === 'string' && room.trim() ? room.trim() : DEFAULT_ROOM;
      const safeText = typeof text === 'string' ? text.trim() : '';

      if (!safeText) return;
      if (safeText.length > 500) return;

      const message = await Message.create({
        sender: socket.data.user.id,
        senderName: socket.data.user.username,
        text: safeText,
        room: safeRoom
      });

      io.to(safeRoom).emit('receive_message', {
        _id: message._id,
        sender: message.sender,
        senderName: message.senderName,
        text: message.text,
        room: message.room,
        createdAt: message.createdAt
      });
    } catch (error) {
      socket.emit('chat_error', 'Message could not be sent. Please try again.');
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