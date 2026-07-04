import { ApiError } from '../utils/apiResponse.js';

const handleJwtError = () => {
  return new ApiError({
    statusCode: 401,
    message: 'Invalid authentication token.'
  });
};

const handleJwtExpiredError = () => {
  return new ApiError({
    statusCode: 401,
    message: 'Session expired. Please sign in again.'
  });
};

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error.name === 'JsonWebTokenError') {
    return handleJwtError();
  }

  if (error.name === 'TokenExpiredError') {
    return handleJwtExpiredError();
  }

  return new ApiError({
    statusCode: error.statusCode || error.status || 500,
    message: error.message || 'Internal server error.',
    error: null,
    isOperational: false
  });
};

const notFoundHandler = (req, res, next) => {
  next(
    new ApiError({
      statusCode: 404,
      message: `Route not found: ${req.originalUrl}`
    })
  );
};

const globalErrorHandler = (error, req, res, next) => {
  const normalizedError = normalizeError(error);
  const exposeStack = process.env.NODE_ENV === 'development';

  if (!normalizedError.isOperational) {
    console.error(error);
  }

  return res
    .status(normalizedError.statusCode)
    .json(normalizedError.toResponse({ exposeStack }));
};

export { notFoundHandler, globalErrorHandler };