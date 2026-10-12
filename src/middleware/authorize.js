import ApiError from '../utils/ApiError.js';

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return next(ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED'));
  }
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS'));
  }
  return next();
};

export default authorize;