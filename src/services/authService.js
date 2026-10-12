import bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import sequelize from '../config/database.js';
import env from '../config/environment.js';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import ApiError from '../utils/ApiError.js';
import { hashRefreshToken } from '../utils/crypto.js';
import { withLock } from '../utils/asyncLock.js';
import { signAccessToken, issueRefreshToken } from './tokenService.js';
import { publicUser } from './userService.js';
import { logAudit, ACTIONS } from './auditService.js';

export const registerUser = async ({ name, email, password }, { requestId } = {}) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  let user;
  try {
    user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: 'USER',
      isActive: true,
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    action: ACTIONS.REGISTER,
    requestId: requestId || null,
    details: { email: user.email },
  });

  return publicUser(user);
};

export const loginUser = async ({ email, password }, { requestId } = {}) => {
  const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });

  if (!user) {
    await logAudit({ action: ACTIONS.LOGIN_FAILED, requestId: requestId || null });
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    await logAudit({
      userId: user.id,
      action: ACTIONS.LOGIN_DISABLED_ACCOUNT,
      requestId: requestId || null,
    });
    throw ApiError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    await logAudit({
      userId: user.id,
      action: ACTIONS.LOGIN_FAILED,
      requestId: requestId || null,
    });
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken(user);
  const { refreshToken } = await issueRefreshToken(user.id);

  await logAudit({
    userId: user.id,
    action: ACTIONS.LOGIN_SUCCESS,
    requestId: requestId || null,
  });

  return { accessToken, refreshToken, user: publicUser(user) };
};

export const refreshTokens = async (rawRefreshToken, { requestId } = {}) => {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string' || rawRefreshToken.length < 10) {
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const rotate = () =>
    sequelize.transaction(async (transaction) => {
      const stored = await RefreshToken.findOne({
        where: { tokenHash },
        transaction,
        ...(env.dbDialect === 'mysql' ? { lock: transaction.LOCK.UPDATE } : {}),
      });

      if (!stored) {
        return { status: 'invalid' };
      }

      if (stored.revokedAt) {
        await RefreshToken.update(
          { revokedAt: new Date() },
          { where: { userId: stored.userId, revokedAt: null }, transaction },
        );
        return { status: 'revoked', userId: stored.userId };
      }

      if (new Date(stored.expiresAt) <= new Date()) {
        return { status: 'expired' };
      }

      const user = await User.findByPk(stored.userId, { transaction });
      if (!user || !user.isActive) {
        return { status: 'account', userId: stored.userId };
      }

      const { refreshToken, instance: newToken } = await issueRefreshToken(user.id, { transaction });

      stored.revokedAt = new Date();
      stored.replacedByTokenId = newToken.id;
      await stored.save({ transaction });

      return {
        status: 'ok',
        userId: user.id,
        accessToken: signAccessToken(user),
        refreshToken,
      };
    });

  // MySQL serializes concurrent rotations with a row lock; SQLite has no such
  // lock, so serialize in-process to keep rotation atomic.
  const result =
    env.dbDialect === 'sqlite'
      ? await withLock(`refresh:${tokenHash}`, rotate)
      : await rotate();

  switch (result.status) {
    case 'invalid':
      throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    case 'revoked':
      await logAudit({
        userId: result.userId,
        action: ACTIONS.REFRESH_TOKEN_REUSE,
        requestId: requestId || null,
      });
      throw ApiError.unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REVOKED');
    case 'expired':
      throw ApiError.unauthorized('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    case 'account':
      throw ApiError.unauthorized('Account is unavailable', 'ACCOUNT_UNAVAILABLE');
    default:
      return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
};

export const logoutUser = async ({ userId, refreshToken }, { requestId } = {}) => {
  if (refreshToken) {
    const record = await RefreshToken.findOne({ where: { tokenHash: hashRefreshToken(refreshToken) } });
    if (record && record.userId === userId && !record.revokedAt) {
      record.revokedAt = new Date();
      await record.save();
    }
  } else {
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null } },
    );
  }

  await logAudit({ userId, action: ACTIONS.LOGOUT, requestId: requestId || null });
  return { revoked: true };
};

export const changePassword = async ({ userId, currentPassword, newPassword }, { requestId } = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordOk) {
    throw ApiError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  await user.save();

  await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });

  await logAudit({ userId, action: ACTIONS.PASSWORD_CHANGED, requestId: requestId || null });

  return { changed: true };
};

export default {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  changePassword,
};