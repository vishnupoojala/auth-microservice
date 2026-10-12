import jwt from 'jsonwebtoken';
import env from '../config/environment.js';
import ApiError from '../utils/ApiError.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateRefreshToken, hashRefreshToken } from '../utils/crypto.js';

export const signAccessToken = (user) =>
  jwt.sign(
    { role: user.role },
    env.jwt.accessSecret,
    {
      subject: user.id,
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: env.jwt.accessExpiresIn,
      algorithm: 'HS256',
    },
  );

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.jwt.accessSecret, {
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      algorithms: ['HS256'],
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
};

export const refreshTokenExpiry = () =>
  new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

export const issueRefreshToken = async (userId, options = {}) => {
  const raw = generateRefreshToken();
  const instance = await RefreshToken.create(
    {
      userId,
      tokenHash: hashRefreshToken(raw),
      expiresAt: refreshTokenExpiry(),
    },
    options,
  );
  return { refreshToken: raw, instance };
};

export default {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  refreshTokenExpiry,
  hashRefreshToken,
};