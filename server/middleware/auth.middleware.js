import User from '../models/User.model.js';
import { verifyToken } from '../config/jwt.js';
import { ApiError } from '../utils/apiResponse.js';

const getBearerToken = (authorizationHeader = '') => {
  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const protect = async (req, res, next) => {
  try {
    const token =
      getBearerToken(req.headers.authorization) ||
      req.cookies?.accessToken;

    if (!token) {
      throw new ApiError({
        statusCode: 401,
        message: 'Authentication token is required.'
      });
    }

    const payload = verifyToken(token);

    if (!payload?.id) {
      throw new ApiError({
        statusCode: 401,
        message: 'Invalid authentication token.'
      });
    }

    const user = await User.findById(payload.id).select('-passwordHash');

    if (!user) {
      throw new ApiError({
        statusCode: 401,
        message: 'This session is no longer valid.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export { protect };