import mongoose from 'mongoose';

import User from '../models/User.model.js';
import Leaderboard from '../models/Leaderboard.model.js';
import { SuccessResponse } from '../utils/apiResponse.js';

const GLOBAL_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_LIMIT = 100;

const { Types } = mongoose;

const isCacheFresh = (lastUpdatedAt) => {
  if (!lastUpdatedAt) {
    return false;
  }

  return Date.now() - new Date(lastUpdatedAt).getTime() < GLOBAL_CACHE_TTL_MS;
};

const getRankFromRating = (rating = 0) => {
  if (rating >= 2400) return 'Grandmaster';
  if (rating >= 2200) return 'International Master';
  if (rating >= 1900) return 'Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1200) return 'Pupil';

  return 'Newbie';
};

const rankAggregationExpression = {
  $switch: {
    branches: [
      { case: { $gte: ['$rating', 2400] }, then: 'Grandmaster' },
      { case: { $gte: ['$rating', 2200] }, then: 'International Master' },
      { case: { $gte: ['$rating', 1900] }, then: 'Master' },
      { case: { $gte: ['$rating', 1600] }, then: 'Expert' },
      { case: { $gte: ['$rating', 1400] }, then: 'Specialist' },
      { case: { $gte: ['$rating', 1200] }, then: 'Pupil' }
    ],
    default: 'Newbie'
  }
};

const getGlobalLeaderboard = async (req, res, next) => {
  try {
    const cachedLeaderboard = await Leaderboard.findOne({
      type: 'GLOBAL',
      gameType: 'TCP_CONGESTION',
      region: null
    }).lean();

    if (
      cachedLeaderboard &&
      isCacheFresh(cachedLeaderboard.lastUpdatedAt)
    ) {
      return new SuccessResponse({
        message: 'Global leaderboard fetched successfully.',
        data: {
          rankings: cachedLeaderboard.rankings,
          cached: true,
          lastUpdatedAt: cachedLeaderboard.lastUpdatedAt
        }
      }).send(res);
    }

    const rankings = await User.aggregate([
      {
        $sort: {
          rating: -1,
          username: 1
        }
      },
      {
        $limit: GLOBAL_LIMIT
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          username: 1,
          fullName: 1,
          rating: 1,
          rank: rankAggregationExpression,
          score: '$rating'
        }
      }
    ]);

    const now = new Date();

    await Leaderboard.findOneAndUpdate(
      {
        type: 'GLOBAL',
        gameType: 'TCP_CONGESTION',
        region: null
      },
      {
        $set: {
          rankings,
          lastUpdatedAt: now
        },
        $setOnInsert: {
          type: 'GLOBAL',
          gameType: 'TCP_CONGESTION',
          region: null
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return new SuccessResponse({
      message: 'Global leaderboard fetched successfully.',
      data: {
        rankings,
        cached: false,
        lastUpdatedAt: now
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const getFriendsLeaderboard = async (req, res, next) => {
  try {
    const friendIds = req.user.friends || [];

    const leaderboardUserIds = [
      req.user._id,
      ...friendIds.map((id) => new Types.ObjectId(id))
    ];

    const users = await User.find({
      _id: {
        $in: leaderboardUserIds
      }
    })
      .select('_id username fullName rating avatarUrl country contribution')
      .sort({
        rating: -1,
        username: 1
      })
      .lean();

    const rankings = users.map((user, index) => ({
      position: index + 1,
      userId: user._id,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      country: user.country,
      contribution: user.contribution,
      rating: user.rating,
      rank: getRankFromRating(user.rating),
      isCurrentUser: user._id.toString() === req.user._id.toString()
    }));

    return new SuccessResponse({
      message: 'Friends leaderboard fetched successfully.',
      data: {
        rankings,
        total: rankings.length
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export {
  getGlobalLeaderboard,
  getFriendsLeaderboard
};