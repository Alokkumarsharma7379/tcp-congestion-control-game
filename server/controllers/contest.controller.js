import Contest from '../models/Contest.model.js';
import { generateRoomCode, registerRoomFromContest } from '../socket/contestSocket.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const toPositiveNumber = (value, fieldName, { allowZero = true, max } = {}) => {
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

  if (max !== undefined && number > max) {
    throw new ApiError({
      statusCode: 400,
      message: `${fieldName} cannot exceed ${max}.`
    });
  }

  return number;
};

const createContest = async (req, res, next) => {
  try {
    const {
      title,
      duration,
      capacity,
      queueSize,
      lossProbability = 0,
      initialCwnd,
      propagationDelay = 0,
      ssthresh = 64,
      maxPlayers = 8
    } = req.body;

    if (!title || !title.trim()) {
      throw new ApiError({ statusCode: 400, message: 'Contest name is required.' });
    }

    const config = {
      duration: toPositiveNumber(duration, 'Duration', { allowZero: false, max: 3600 }),
      capacity: toPositiveNumber(capacity, 'Bottleneck capacity', { allowZero: false, max: 500 }),
      queueSize: toPositiveNumber(queueSize, 'Max queue size', { allowZero: false, max: 1000 }),
      lossProbability: toPositiveNumber(lossProbability, 'Loss rate', { max: 1 }),
      initialCwnd: toPositiveNumber(initialCwnd, 'Initial CWND', { allowZero: false, max: 500 }),
      propagationDelay: toPositiveNumber(propagationDelay, 'Propagation delay', { max: 2000 }),
      ssthresh: toPositiveNumber(ssthresh, 'Threshold', { allowZero: false, max: 500 }),
      maxPlayers: Math.min(Math.max(Math.round(Number(maxPlayers) || 8), 2), 100)
    };

    const roomCode = await generateRoomCode();

    const contest = await Contest.create({
      roomCode,
      host: req.user._id,
      title: title.trim(),
      config,
      status: 'waiting',
      participants: [
        {
          user: req.user._id,
          username: req.user.username,
          isReady: false
        }
      ]
    });

    registerRoomFromContest(contest);

    return new SuccessResponse({
      statusCode: 201,
      message: 'Contest created successfully.',
      data: { contest }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const getContestByRoomCode = async (req, res, next) => {
  try {
    const roomCode = String(req.params.roomCode || '').toUpperCase();

    const contest = await Contest.findOne({ roomCode }).populate({
      path: 'host',
      select: 'username'
    });

    if (!contest) {
      throw new ApiError({ statusCode: 404, message: 'Contest not found.' });
    }

    return new SuccessResponse({
      message: 'Contest fetched successfully.',
      data: { contest }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const getContestResults = async (req, res, next) => {
  try {
    const roomCode = String(req.params.roomCode || '').toUpperCase();

    const contest = await Contest.findOne({ roomCode });

    if (!contest) {
      throw new ApiError({ statusCode: 404, message: 'Contest not found.' });
    }

    const ranked = [...contest.participants].sort(
      (a, b) => (a.finalRank || 999) - (b.finalRank || 999)
    );

    return new SuccessResponse({
      message: 'Contest results fetched successfully.',
      data: {
        title: contest.title,
        status: contest.status,
        participants: ranked
      }
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export { createContest, getContestByRoomCode, getContestResults };
