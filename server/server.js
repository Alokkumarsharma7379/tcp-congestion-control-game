import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import app from './app.js';
import connectDB from './config/db.js';
import { verifyToken } from './config/jwt.js';
import User from './models/User.model.js';
import Message from './models/Message.model.js';
import { registerContestHandlers } from './socket/contestSocket.js';

const { isValidObjectId } = mongoose;

const PORT = process.env.PORT || 5000;
const HISTORY_LIMIT = 50;
const GLOBAL_ROOM = 'global';

const personalRoomFor = (userId) => `user:${userId}`;

// ---- In-memory presence tracking ----
// Maps userId -> Set of that user's currently-connected socket ids. This is
// per-process state: fine for a single server instance, but won't be shared
// across multiple instances behind a load balancer without a shared store
// (e.g. a Redis-backed Socket.IO adapter) — worth knowing if you scale up.
const onlineUsers = new Map();

const markOnline = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  const set = onlineUsers.get(userId);
  const wasOffline = set.size === 0;
  set.add(socketId);
  return wasOffline;
};

const markOffline = (userId, socketId) => {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
};

// A direct-message room id is always "<idA>_<idB>" with both ids sorted —
// this validates a client-supplied roomId actually belongs to the
// requesting socket's own user before letting them join or act on it.
const isValidDmRoomForUser = (roomId, userId) => {
  if (typeof roomId !== 'string') return false;
  const parts = roomId.split('_');
  if (parts.length !== 2) return false;
  if (!isValidObjectId(parts[0]) || !isValidObjectId(parts[1])) return false;
  return parts.includes(String(userId));
};

const getOtherUserIdFromRoom = (roomId, userId) => {
  const parts = roomId.split('_');
  return parts.find((part) => part !== String(userId));
};

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));

    const payload = verifyToken(token);
    if (!payload?.id) return next(new Error('Invalid authentication token.'));

    const user = await User.findById(payload.id).select('username');
    if (!user) return next(new Error('This session is no longer valid.'));

    socket.data.user = { id: user._id.toString(), username: user.username };
    next();
  } catch {
    next(new Error('Authentication failed.'));
  }
});

io.on('connection', (socket) => {
  const selfId = socket.data.user.id;

  socket.join(personalRoomFor(selfId));

  const becameOnline = markOnline(selfId, socket.id);
  socket.emit('online_users', Array.from(onlineUsers.keys()));
  if (becameOnline) io.emit('user_online', selfId);
  registerContestHandlers(io, socket);

  socket.on('disconnect', () => {
    const becameOffline = markOffline(selfId, socket.id);
    if (becameOffline) io.emit('user_offline', selfId);
  });

  /* ───────────────────── Global Chat ───────────────────── */

  socket.on('join_room', async () => {
    try {
      socket.join(GLOBAL_ROOM);

      const recentMessages = await Message.find({
        room: GLOBAL_ROOM,
        chatType: 'global',
        deletedForUsers: { $ne: selfId }
      })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      socket.emit('room_history', {
        room: GLOBAL_ROOM,
        messages: recentMessages.reverse()
      });
    } catch {
      socket.emit('chat_error', 'Could not load chat history.');
    }
  });

  socket.on('send_message', async ({ text } = {}) => {
    try {
      const safeText = typeof text === 'string' ? text.trim() : '';
      if (!safeText || safeText.length > 500) return;

      const message = await Message.create({
        sender: selfId,
        senderName: socket.data.user.username,
        chatType: 'global',
        room: GLOBAL_ROOM,
        text: safeText
      });

      io.to(GLOBAL_ROOM).emit('receive_message', {
        _id: message._id,
        sender: message.sender,
        senderName: message.senderName,
        room: message.room,
        text: message.text,
        isDeletedForEveryone: message.isDeletedForEveryone,
        createdAt: message.createdAt
      });
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

      io.to(GLOBAL_ROOM).emit('message_deleted', {
        messageId: message._id,
        room: message.room
      });
    } catch {
      socket.emit('chat_error', 'Could not delete that message.');
    }
  });

  /* ───────────────────── Direct Messages ───────────────────── */

  socket.on('join_dm_room', async (roomId) => {
    try {
      if (!isValidDmRoomForUser(roomId, selfId)) {
        return socket.emit('chat_error', 'Invalid conversation room.');
      }

      socket.join(roomId);

      const messages = await Message.find({
        room: roomId,
        chatType: 'direct',
        deletedForUsers: { $ne: selfId }
      })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      socket.emit('dm_room_history', {
        room: roomId,
        messages: messages.reverse()
      });
    } catch {
      socket.emit('chat_error', 'Could not load conversation history.');
    }
  });

  socket.on('send_dm_message', async ({ roomId, text } = {}) => {
    try {
      const safeText = typeof text === 'string' ? text.trim() : '';
      if (!safeText || safeText.length > 500) return;

      if (!isValidDmRoomForUser(roomId, selfId)) {
        return socket.emit('chat_error', 'Invalid conversation room.');
      }

      const recipientId = getOtherUserIdFromRoom(roomId, selfId);

      if (!(await User.exists({ _id: recipientId }))) {
        return socket.emit('chat_error', 'That user no longer exists.');
      }

      const message = await Message.create({
        sender: selfId,
        senderName: socket.data.user.username,
        recipient: recipientId,
        chatType: 'direct',
        room: roomId,
        text: safeText
      });

      const payload = {
        _id: message._id,
        sender: message.sender,
        senderName: message.senderName,
        recipient: message.recipient,
        room: message.room,
        text: message.text,
        isEdited: message.isEdited,
        isDeletedForEveryone: message.isDeletedForEveryone,
        createdAt: message.createdAt
      };

      io.to(personalRoomFor(selfId)).emit('dm_message_received', payload);
      io.to(personalRoomFor(recipientId)).emit('dm_message_received', payload);
    } catch {
      socket.emit('chat_error', 'Message could not be sent. Please try again.');
    }
  });

  socket.on('edit_dm_message', async ({ messageId, text } = {}) => {
    try {
      if (!messageId || !isValidObjectId(messageId)) return;

      const safeText = typeof text === 'string' ? text.trim() : '';
      if (!safeText || safeText.length > 500) {
        return socket.emit('chat_error', 'Message cannot be empty.');
      }

      const message = await Message.findById(messageId);
      if (!message) return;

      if (String(message.sender) !== selfId) {
        return socket.emit('chat_error', 'You can only edit your own messages.');
      }

      if (message.isDeletedForEveryone) {
        return socket.emit('chat_error', 'This message was deleted and can no longer be edited.');
      }

      message.text = safeText;
      message.isEdited = true;
      await message.save();

      const payload = { messageId: message._id, text: message.text, room: message.room };

      io.to(personalRoomFor(String(message.sender))).emit('dm_message_edited', payload);
      io.to(personalRoomFor(String(message.recipient))).emit('dm_message_edited', payload);
    } catch {
      socket.emit('chat_error', 'Could not edit that message.');
    }
  });

  socket.on('delete_dm_for_me', async ({ messageId } = {}) => {
    try {
      if (!messageId || !isValidObjectId(messageId)) return;

      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { deletedForUsers: selfId } },
        { new: true }
      );

      if (!message) return;

      socket.emit('dm_message_deleted_for_me', {
        messageId: message._id,
        room: message.room
      });
    } catch {
      socket.emit('chat_error', 'Could not delete that message.');
    }
  });

  socket.on('delete_dm_for_everyone', async ({ messageId } = {}) => {
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

      const payload = { messageId: message._id, room: message.room };

      io.to(personalRoomFor(String(message.sender))).emit('dm_message_deleted', payload);
      io.to(personalRoomFor(String(message.recipient))).emit('dm_message_deleted', payload);
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