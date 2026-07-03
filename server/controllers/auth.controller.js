import bcrypt from 'bcryptjs';

import User from '../models/User.model.js';
import { generateToken } from '../config/jwt.js';
import { ApiError, SuccessResponse } from '../utils/apiResponse.js';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

const buildUserProfile = (user) => ({
  id: user._id,
  username: user.username,
  fullName: user.fullName,
  email: user.email,
  country: user.country,
  avatarUrl: user.avatarUrl,
  contribution: user.contribution,
  rating: user.rating,
  rank: user.rank,
  currentStreak: user.currentStreak,
  maxYearlyStreak: user.maxYearlyStreak,
  totalStreak: user.totalStreak,
  gamesPlayedThisMonth: user.gamesPlayedThisMonth,
  lastPlayedDate: user.lastPlayedDate,
  lastVisit: user.lastVisit,
  createdAt: user.createdAt
});

const issueAuthPayload = (user) => {
  const token = generateToken({
    id: user._id,
    username: user.username
  });

  return {
    token,
    user: buildUserProfile(user)
  };
};

const register = async (req, res, next) => {
  try {
    const { username, fullName = '', email, password, country = '' } = req.body;

    const cleanUsername = username?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password) {
      throw new ApiError({
        statusCode: 400,
        message: 'Username, email, and password are required.'
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError({
        statusCode: 400,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    if (existingUser) {
      const takenField =
        existingUser.email === cleanEmail ? 'email' : 'username';

      throw new ApiError({
        statusCode: 409,
        message: `This ${takenField} is already taken.`
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      username: cleanUsername,
      fullName: fullName.trim(),
      email: cleanEmail,
      passwordHash,
      country: country.trim(),
      lastVisit: new Date()
    });

    return new SuccessResponse({
      statusCode: 201,
      message: 'Account created successfully.',
      data: issueAuthPayload(user)
    }).send(res);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const identifier = (email || username)?.trim();

    if (!identifier || !password) {
      throw new ApiError({
        statusCode: 400,
        message: 'Username/email and password are required.'
      });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() }
      ]
    }).select('+passwordHash');

    if (!user) {
      throw new ApiError({
        statusCode: 401,
        message: 'Invalid credentials.'
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new ApiError({
        statusCode: 401,
        message: 'Invalid credentials.'
      });
    }

    user.lastVisit = new Date();
    await user.save({ validateBeforeSave: false });

    return new SuccessResponse({
      statusCode: 200,
      message: 'Signed in successfully.',
      data: issueAuthPayload(user)
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export { register, login };