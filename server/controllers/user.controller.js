import mongoose from 'mongoose';

import User from '../models/User.model.js';
import { getUserActivityHeatmap } from '../services/heatmap.service.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const { isValidObjectId } = mongoose;

const getProfile = async (req, res, next) => {
  try {
    const [user, heatmap] = await Promise.all([
      User.findById(req.user._id)
        .select('-passwordHash')
        .populate({
          path: 'friends',
          select: '_id username rating avatarUrl'
        }),
      getUserActivityHeatmap(req.user._id)
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
        heatmap
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const addFriend = async (req, res, next) => {
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: {
          friends: friend._id
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
      .select('-passwordHash')
      .populate({
        path: 'friends',
        select: '_id username rating avatarUrl'
      });

    return new SuccessResponse({
      message: 'Friend added successfully.',
      data: {
        user: user.toJSON(),
        friend
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export { getProfile, addFriend };