import { UniqueConstraintError } from 'sequelize';
import { Op } from 'sequelize';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { logAudit, ACTIONS } from './auditService.js';

const SAFE_FIELDS = ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'];

export const publicUser = (user) => {
  const result = {};
  SAFE_FIELDS.forEach((field) => {
    if (user[field] !== undefined) result[field] = user[field];
  });
  if (result.isActive !== undefined) result.isActive = Boolean(result.isActive);
  return result;
};

const normalizeEmail = (email) => String(email).trim().toLowerCase();

export const getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['passwordHash'] },
  });
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }
  return publicUser(user);
};

export const updateProfile = async (userId, fields) => {
  const allowed = {};
  if (fields.name !== undefined) allowed.name = String(fields.name).trim();
  if (fields.email !== undefined) allowed.email = normalizeEmail(fields.email);

  if (Object.keys(allowed).length === 0) {
    throw ApiError.badRequest('No updatable fields were provided', 'NOTHING_TO_UPDATE');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  try {
    await user.update(allowed);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw error;
  }

  return publicUser(user);
};

export const countActiveAdmins = async () =>
  User.count({ where: { role: 'ADMIN', isActive: true } });

const ensureNotSelf = (actorId, targetId, action) => {
  if (String(actorId) === String(targetId)) {
    throw ApiError.badRequest(`You cannot ${action} your own account`, 'SELF_OPERATION_BLOCKED');
  }
};

const ensureLastAdminSafe = async (target, action) => {
  if (target.role === 'ADMIN') {
    const admins = await countActiveAdmins();
    if (admins <= 1) {
      throw ApiError.badRequest(
        `Cannot ${action} the last active administrator`,
        'LAST_ADMIN_PROTECTED',
      );
    }
  }
};

export const listUsers = async ({ page = 1, limit = 10, search }) => {
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }
  const offset = (page - 1) * limit;
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return {
    items: rows.map(publicUser),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
  };
};

export const getUserById = async (id) => {
  const user = await User.findByPk(id, {
    attributes: { exclude: ['passwordHash'] },
  });
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }
  return publicUser(user);
};

export const setUserStatus = async (actorId, targetId, isActive, { requestId } = {}) => {
  ensureNotSelf(actorId, targetId, 'change the status of');

  const user = await User.findByPk(targetId);
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  await ensureLastAdminSafe(user, 'disable');

  user.isActive = Boolean(isActive);
  await user.save();

  await logAudit({
    userId: actorId,
    targetUserId: user.id,
    action: ACTIONS.ADMIN_USER_STATUS_CHANGED,
    requestId: requestId || null,
    details: { isActive: user.isActive },
  });

  return publicUser(user);
};

export const setUserRole = async (actorId, targetId, role, { requestId } = {}) => {
  ensureNotSelf(actorId, targetId, 'change the role of');

  const user = await User.findByPk(targetId);
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  if (user.role === role) {
    return publicUser(user);
  }

  if (user.role === 'ADMIN' && role === 'USER') {
    await ensureLastAdminSafe(user, 'demote');
  }

  user.role = role;
  await user.save();

  await logAudit({
    userId: actorId,
    targetUserId: user.id,
    action: ACTIONS.ADMIN_USER_ROLE_CHANGED,
    requestId: requestId || null,
    details: { from: user.previous('role'), to: user.role },
  });

  return publicUser(user);
};

export const deleteUser = async (actorId, targetId, { requestId } = {}) => {
  ensureNotSelf(actorId, targetId, 'delete');

  const user = await User.findByPk(targetId);
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  await ensureLastAdminSafe(user, 'delete');

  const { email } = user;
  await user.destroy();

  await logAudit({
    userId: actorId,
    targetUserId: null,
    action: ACTIONS.ADMIN_USER_DELETED,
    requestId: requestId || null,
    details: { id: targetId, email },
  });

  return { deleted: true, id: targetId };
};

export default {
  publicUser,
  getProfile,
  updateProfile,
  listUsers,
  getUserById,
  setUserStatus,
  setUserRole,
  deleteUser,
};