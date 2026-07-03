import { ApiError } from '../utils/apiResponse.js';

const handleCastError = (error) => {
  return new ApiError({
    statusCode: 400,
    message: 'Invalid resource identifier.',
    error: {
      field: error.path,
      value: error.value
    }
  });
};

const handleValidationError = (error) => {
  const fields = Object.values(error.errors).reduce((acc, fieldError) => {
    acc[fieldError.path] = fieldError.message;
    return acc;
  }, {});

  return new ApiError({
    statusCode: 400,
    message: 'Validation failed.',
    error: fields
  });
};

const handleDuplicateKeyError = (error) => {
  const fields = Object.keys(error.keyValue || {});

  return new ApiError({
    statusCode: 409,
    message: 'Duplicate value already exists.',
    error: {
      fields,
      values: error.keyValue
    }
  });
};

const handleJwtExpiredError = () => {
  return new ApiError({
    statusCode: 401,
    message: 'Session expired. Please sign in again.'
  });
};

const handleJwtError = () => {
  return new ApiError({
    statusCode: 401,
    message: 'Invalid authentication token.'
  });
};

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error.name === 'CastError') {
    return handleCastError(error);
  }

  if (error.name === 'ValidationError') {
    return handleValidationError(error);
  }

  if (error.code === 11000) {
    return handleDuplicateKeyError(error);
  }

  if (error.name === 'TokenExpiredError') {
    return handleJwtExpiredError(error);
  }

  if (error.name === 'JsonWebTokenError') {
    return handleJwtError(error);
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
    .json(normalizedError.toJSON({ exposeStack }));
};

export { notFoundHandler, globalErrorHandler };