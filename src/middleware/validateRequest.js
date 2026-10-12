import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

export const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result.array().map((error) => ({
      field: error.path || error.param || 'unknown',
      message: error.msg,
    }));
    return next(ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details));
  }
  return next();
};

export default validateRequest;