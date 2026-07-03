import mongoose from 'mongoose';

import GameSession from '../models/GameSession.model.js';

const { Types } = mongoose;

const getUserActivityHeatmap = async (userId) => {
  const normalizedUserId =
    userId instanceof Types.ObjectId ? userId : new Types.ObjectId(userId);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 365);
  since.setUTCHours(0, 0, 0, 0);

  const activity = await GameSession.aggregate([
    {
      $match: {
        userId: normalizedUserId,
        playedAt: {
          $gte: since
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$playedAt',
            timezone: 'UTC'
          }
        },
        count: {
          $sum: 1
        },
        totalScore: {
          $sum: '$score'
        }
      }
    },
    {
      $sort: {
        _id: 1
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        count: 1,
        totalScore: 1
      }
    }
  ]);

  return activity;
};

export { getUserActivityHeatmap };