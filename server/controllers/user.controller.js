import mongoose from 'mongoose';

import User from '../models/User.model.js';
import { getUserActivityHeatmap } from '../services/heatmap.service.js';
import { getRatingHistory } from '../services/history.service.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const { isValidObjectId } = mongoose;

const PUBLIC_PROFILE_FIELDS =
  'username fullName country avatarUrl rating contribution ' +
  'currentStreak maxYearlyStreak totalStreak gamesPlayedThisMonth ' +
  'lastVisit createdAt friends';

const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError({
        statusCode: 400,
        message: 'Avatar image is required.'
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        avatarUrl,
        lastVisit: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-passwordHash');

    return new SuccessResponse({
      message: 'Profile picture updated successfully.',
      data: {
        user: user.toJSON()
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const [user, heatmap, ratingHistory] = await Promise.all([
      User.findById(req.user._id)
        .select('-passwordHash')
        .populate({
          path: 'friends',
          select: '_id username rating avatarUrl'
        }),
      getUserActivityHeatmap(req.user._id),
      getRatingHistory(req.user._id)
    ]);

    if (!user) {
      throw new ApiError({
        statusCode: 404,
        message: 'User profile not found.'
      });
    }

    return new SuccessResponse({
      message: 'Profile fetched successfully.',
      data: {
        user: user.toJSON(),
        heatmap,
        ratingHistory
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// Public-facing profile lookup by username — used by /u/:username.
// Deliberately exposes a narrower field set than getProfile (no email).
const getPublicProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    const account = await User.findOne({ username })
      .select(PUBLIC_PROFILE_FIELDS);

    if (!account) {
      throw new ApiError({
        statusCode: 404,
        message: 'This user does not exist.'
      });
    }

    const [heatmap, ratingHistory] = await Promise.all([
      getUserActivityHeatmap(account._id),
      getRatingHistory(account._id)
    ]);

    const isSelf = Boolean(
      req.user && req.user._id.toString() === account._id.toString()
    );

    const isFriend = req.user
      ? req.user.friends.some(
          (friendId) => friendId.toString() === account._id.toString()
        )
      : null;

    return new SuccessResponse({
      message: 'Public profile fetched successfully.',
      data: {
        user: {
          id: account._id,
          username: account.username,
          fullName: account.fullName,
          country: account.country,
          avatarUrl: account.avatarUrl,
          rating: account.rating,
          rank: account.rank,
          contribution: account.contribution,
          currentStreak: account.currentStreak,
          maxYearlyStreak: account.maxYearlyStreak,
          totalStreak: account.totalStreak,
          gamesPlayedThisMonth: account.gamesPlayedThisMonth,
          lastVisit: account.lastVisit,
          createdAt: account.createdAt,
          friendCount: account.friends.length
        },
        heatmap,
        ratingHistory,
        isSelf,
        isFriend
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// Toggles the friend relationship both ways so "friends" and "friend of"
// always mean the same, mutual thing rather than a one-directional follow.
const toggleFriend = async (req, res, next) => {
  try {
    const friendId = req.params.friendId || req.body.friendId;

    if (!friendId) {
      throw new ApiError({
        statusCode: 400,
        message: 'Friend id is required.'
      });
    }

    if (!isValidObjectId(friendId)) {
      throw new ApiError({
        statusCode: 400,
        message: 'Invalid friend id.'
      });
    }

    if (friendId.toString() === req.user._id.toString()) {
      throw new ApiError({
        statusCode: 400,
        message: 'You cannot add yourself as a friend.'
      });
    }

    const friend = await User.findById(friendId).select(
      '_id username rating avatarUrl'
    );

    if (!friend) {
      throw new ApiError({
        statusCode: 404,
        message: 'Friend user not found.'
      });
    }

    const alreadyFriends = req.user.friends.some(
      (id) => id.toString() === friend._id.toString()
    );

    const selfUpdate = alreadyFriends
      ? { $pull: { friends: friend._id } }
      : { $addToSet: { friends: friend._id } };

    const reciprocalUpdate = alreadyFriends
      ? { $pull: { friends: req.user._id } }
      : { $addToSet: { friends: req.user._id } };

    const [user] = await Promise.all([
      User.findByIdAndUpdate(req.user._id, selfUpdate, {
        new: true,
        runValidators: true
      })
        .select('-passwordHash')
        .populate({
          path: 'friends',
          select: '_id username rating avatarUrl'
        }),
      User.findByIdAndUpdate(friend._id, reciprocalUpdate)
    ]);

    return new SuccessResponse({
      message: alreadyFriends
        ? 'Friend removed successfully.'
        : 'Friend added successfully.',
      data: {
        user: user.toJSON(),
        friend,
        isFriend: !alreadyFriends
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export { getProfile, getPublicProfileByUsername, toggleFriend, updateAvatar };