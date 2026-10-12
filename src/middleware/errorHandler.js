import ApiError from '../utils/ApiError.js';
import env from '../config/environment.js';

const isSequelizeError = (error) =>
  error.name === 'SequelizeValidationError' ||
  error.name === 'SequelizeUniqueConstraintError' ||
  error.name === 'SequelizeDatabaseError' ||
  error.name === 'SequelizeForeignKeyConstraintError';

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

export const errorHandler = (error, req, res, next) => {
  let apiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof SyntaxError && error.status === 400) {
    apiError = ApiError.badRequest('Malformed JSON in request body', 'MALFORMED_JSON');
  } else if (isSequelizeError(error)) {
    console.error('[error] Database error:', error.name, error.message);
    apiError = env.isProduction
      ? ApiError.internal()
      : new ApiError(500, 'Database operation failed', 'DATABASE_ERROR');
  } else {
    console.error('[error] Unhandled error:', error);
    apiError = env.isProduction
      ? ApiError.internal()
      : new ApiError(500, error.message || 'Internal server error', 'INTERNAL_ERROR');
  }

  const requestId = req.id || null;

  if (res.headersSent) {
    return next(error);
  }

  const body = {
    success: false,
    message: apiError.message,
    error: {
      code: apiError.code,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  };

  if (requestId) body.requestId = requestId;

  return res.status(apiError.statusCode).json(body);
};

export default errorHandler;