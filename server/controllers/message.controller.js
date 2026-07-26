import mongoose from 'mongoose';

import Message from '../models/Message.model.js';
import User from '../models/User.model.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const { isValidObjectId } = mongoose;

const directRoomFor = (userIdA, userIdB) =>
  [String(userIdA), String(userIdB)].sort().join('_');

// Sidebar list: the most recent message per direct conversation the
// requesting user is part of, with the other participant's basic profile
// attached, newest conversation first.
const getConversations = async (req, res, next) => {
  try {
    const selfId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
          chatType: 'direct',
          $or: [{ sender: selfId }, { recipient: selfId }],
          deletedForUsers: { $ne: selfId }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$room',
          lastMessage: { $first: '$$ROOT' }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const otherUserIds = conversations.map((entry) => {
      const { sender, recipient } = entry.lastMessage;
      return String(sender) === String(selfId) ? recipient : sender;
    });

    const otherUsers = await User.find({ _id: { $in: otherUserIds } })
      .select('_id username avatarUrl rating')
      .lean();

    const otherUserById = new Map(
      otherUsers.map((otherUser) => [String(otherUser._id), otherUser])
    );

    const result = conversations
      .map((entry) => {
        const { sender, recipient, text, isDeletedForEveryone, createdAt } = entry.lastMessage;
        const otherUserId = String(sender) === String(selfId) ? recipient : sender;
        const otherUser = otherUserById.get(String(otherUserId));

        if (!otherUser) return null;

        return {
          room: entry._id,
          otherUser,
          lastMessage: {
            text: isDeletedForEveryone ? 'This message was deleted' : text,
            createdAt,
            wasMine: String(sender) === String(selfId)
          }
        };
      })
      .filter(Boolean);

    return new SuccessResponse({
      message: 'Conversations fetched successfully.',
      data: { conversations: result }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// Full-ish history (last 50) for one direct conversation, plus the other
// user's basic profile so the chat header can render immediately.
const getDirectHistory = async (req, res, next) => {
  try {
    const { userId: otherUserId } = req.params;
    const selfId = req.user._id;

    if (!isValidObjectId(otherUserId)) {
      throw new ApiError({ statusCode: 400, message: 'Invalid user id.' });
    }

    if (String(otherUserId) === String(selfId)) {
      throw new ApiError({ statusCode: 400, message: 'You cannot message yourself.' });
    }

    const otherUser = await User.findById(otherUserId)
      .select('_id username avatarUrl rating')
      .lean();

    if (!otherUser) {
      throw new ApiError({ statusCode: 404, message: 'This user does not exist.' });
    }

    const room = directRoomFor(selfId, otherUserId);

    const messages = await Message.find({
      room,
      deletedForUsers: { $ne: selfId }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return new SuccessResponse({
      message: 'Conversation history fetched successfully.',
      data: {
        room,
        otherUser,
        messages: messages.reverse()
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export { getConversations, getDirectHistory };