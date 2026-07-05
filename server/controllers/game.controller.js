import GameSession from '../models/GameSession.model.js';
import User from '../models/User.model.js';
import { calculateNewRating } from '../services/rating.service.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toPositiveNumber = (value, fieldName, { allowZero = true } = {}) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new ApiError({
      statusCode: 400,
      message: `${fieldName} must be a valid number.`
    });
  }

  if (allowZero ? number < 0 : number <= 0) {
    throw new ApiError({
      statusCode: 400,
      message: `${fieldName} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`
    });
  }

  return number;
};

const startOfUtcDay = (date) => {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
};

const isSameUtcDay = (a, b) => {
  return startOfUtcDay(a) === startOfUtcDay(b);
};

const isNextUtcDay = (previousDate, currentDate) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return startOfUtcDay(currentDate) - startOfUtcDay(previousDate) === oneDay;
};

const isSameUtcMonth = (a, b) => {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
};

const calculateStreakUpdate = (user, playedAt) => {
  const lastPlayedDate = user.lastPlayedDate;
  const previousCurrentStreak = user.currentStreak || 0;

  let currentStreak = 1;

  if (lastPlayedDate) {
    if (isSameUtcDay(lastPlayedDate, playedAt)) {
      currentStreak = previousCurrentStreak || 1;
    } else if (isNextUtcDay(lastPlayedDate, playedAt)) {
      currentStreak = previousCurrentStreak + 1;
    }
  }

  return {
    currentStreak,
    maxYearlyStreak: Math.max(user.maxYearlyStreak || 0, currentStreak),
    playedTodayAlready: lastPlayedDate
      ? isSameUtcDay(lastPlayedDate, playedAt)
      : false,
    sameMonthAsLastPlay: lastPlayedDate
      ? isSameUtcMonth(lastPlayedDate, playedAt)
      : false
  };
};

const submitScore = async (req, res, next) => {
  try {
    const {
      gameType = 'TCP_CONGESTION',
      score,
      peakWindowSize = 0,
      timeoutsCount = 0,
      durationInSeconds
    } = req.body;

    if (score === undefined || durationInSeconds === undefined) {
      throw new ApiError({
        statusCode: 400,
        message: 'Score and durationInSeconds are required.'
      });
    }

    const validScore = toPositiveNumber(score, 'score');
    const validPeakWindowSize = toPositiveNumber(peakWindowSize, 'peakWindowSize');
    const validTimeoutsCount = toPositiveNumber(timeoutsCount, 'timeoutsCount');
    const validDurationInSeconds = toPositiveNumber(
      durationInSeconds,
      'durationInSeconds',
      { allowZero: false }
    );

    const ratingResult = calculateNewRating(
      req.user.rating,
      validScore,
      {
        peakWindowSize: validPeakWindowSize,
        timeoutsCount: validTimeoutsCount,
        durationInSeconds: validDurationInSeconds
      }
    );

    const sessionPayload = {
      userId: req.user._id,
      gameType,
      score: validScore,
      peakWindowSize: validPeakWindowSize,
      timeoutsCount: validTimeoutsCount,
      durationInSeconds: validDurationInSeconds,
      ratingBefore: ratingResult.previousRating,
      ratingAfter: ratingResult.newRating,
      ratingDelta: ratingResult.ratingDelta,
      playedAt: new Date()
    };

    const savedSession = await GameSession.create(sessionPayload);

    const streakUpdate = calculateStreakUpdate(
      req.user,
      sessionPayload.playedAt
    );

    const update = {
      $set: {
        rating: ratingResult.newRating,
        currentStreak: streakUpdate.currentStreak,
        maxYearlyStreak: streakUpdate.maxYearlyStreak,
        lastPlayedDate: sessionPayload.playedAt,
        lastVisit: new Date()
      },
      $inc: {
        totalStreak: 1
      }
    };

    if (streakUpdate.sameMonthAsLastPlay) {
      update.$inc.gamesPlayedThisMonth = 1;
    } else {
      update.$set.gamesPlayedThisMonth = 1;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      update,
      {
        new: true,
        runValidators: true
      }
    ).select('-passwordHash');

    if (!updatedUser) {
      throw new ApiError({
        statusCode: 404,
        message: 'User not found while updating score.'
      });
    }

    return new SuccessResponse({
      statusCode: 201,
      message: 'Score submitted successfully.',
      data: {
        session: savedSession,
        rating: {
          previousRating: ratingResult.previousRating,
          newRating: ratingResult.newRating,
          delta: ratingResult.ratingDelta,
          previousRank: ratingResult.previousRank,
          newRank: ratingResult.newRank,
          performanceRating: ratingResult.performanceRating
        },
        streak: {
          currentStreak: updatedUser.currentStreak,
          maxYearlyStreak: updatedUser.maxYearlyStreak,
          totalStreak: updatedUser.totalStreak,
          gamesPlayedThisMonth: updatedUser.gamesPlayedThisMonth,
          playedTodayAlready: streakUpdate.playedTodayAlready
        },
        user: updatedUser
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || DEFAULT_PAGE, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      GameSession.find({ userId: req.user._id })
        .sort({ playedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GameSession.countDocuments({ userId: req.user._id })
    ]);

    return new SuccessResponse({
      message: 'Game history fetched successfully.',
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1
        }
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export {
  submitScore,
  getHistory
};