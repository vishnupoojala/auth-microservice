import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  changePassword,
} from '../services/authService.js';

const withRequestId = (req) => ({ requestId: req.id || null });

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(
    { name: req.body.name, email: req.body.email, password: req.body.password },
    withRequestId(req),
  );
  created(res, { user }, 'Registration successful');
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(
    { email: req.body.email, password: req.body.password },
    withRequestId(req),
  );
  ok(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await refreshTokens(req.body.refreshToken, withRequestId(req));
  ok(res, result, 'Tokens refreshed successfully');
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(
    { userId: req.user.id, refreshToken: req.body.refreshToken },
    withRequestId(req),
  );
  ok(res, { revoked: true }, 'Logged out successfully');
});

export const changeUserPassword = asyncHandler(async (req, res) => {
  await changePassword(
    {
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    },
    withRequestId(req),
  );
  ok(res, null, 'Password changed successfully. All existing sessions have been revoked.');
});

export default {
  register,
  login,
  refresh,
  logout,
  changeUserPassword,
};