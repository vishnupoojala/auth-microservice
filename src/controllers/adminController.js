import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import {
  listUsers,
  getUserById,
  setUserStatus,
  setUserRole,
  deleteUser,
} from '../services/userService.js';
import { logAudit, ACTIONS } from '../services/auditService.js';

const withRequestId = (req) => ({ requestId: req.id || null });

export const getUsers = asyncHandler(async (req, res) => {
  const result = await listUsers({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search,
  });
  await logAudit({
    userId: req.user.id,
    action: ACTIONS.ADMIN_USER_LIST,
    requestId: req.id || null,
  });
  ok(res, result, 'Users retrieved successfully');
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  await logAudit({
    userId: req.user.id,
    targetUserId: user.id,
    action: ACTIONS.ADMIN_USER_GET,
    requestId: req.id || null,
  });
  ok(res, { user }, 'User retrieved successfully');
});

export const changeStatus = asyncHandler(async (req, res) => {
  const user = await setUserStatus(
    req.user.id,
    req.params.id,
    req.body.isActive,
    withRequestId(req),
  );
  ok(res, { user }, 'User status updated successfully');
});

export const changeRole = asyncHandler(async (req, res) => {
  const user = await setUserRole(req.user.id, req.params.id, req.body.role, withRequestId(req));
  ok(res, { user }, 'User role updated successfully');
});

export const removeUser = asyncHandler(async (req, res) => {
  const result = await deleteUser(req.user.id, req.params.id, withRequestId(req));
  ok(res, result, 'User deleted successfully');
});

export default { getUsers, getUser, changeStatus, changeRole, removeUser };