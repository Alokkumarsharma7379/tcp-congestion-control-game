class SuccessResponse {
  constructor({
    statusCode = 200,
    message = 'Request completed successfully.',
    data = null
  } = {}) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: true,
      data: this.data,
      message: this.message,
      error: null
    });
  }
}

class ApiError extends Error {
  constructor({
    statusCode = 500,
    message = 'Internal server error.',
    error = null,
    isOperational = true
  } = {}) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.error = error;
    this.isOperational = isOperational;

    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON({ exposeStack = false } = {}) {
    return {
      success: false,
      data: null,
      message: this.message,
      error: {
        statusCode: this.statusCode,
        details: this.error,
        ...(exposeStack ? { stack: this.stack } : {})
      }
    };
  }
}

export { SuccessResponse, ApiError };