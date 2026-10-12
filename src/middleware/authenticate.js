import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/tokenService.js';

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const parts = String(header).split(' ');
    const scheme = parts[0];

    if (scheme !== 'Bearer' || !parts[1]) {
      throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
    }

    const decoded = verifyAccessToken(parts[1]);

    const user = await User.findByPk(decoded.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authenticate;