import AuditLog from '../models/AuditLog.js';

export const ACTIONS = {
  REGISTER: 'REGISTER',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_DISABLED_ACCOUNT: 'LOGIN_DISABLED_ACCOUNT',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  REFRESH_TOKEN_REUSE: 'REFRESH_TOKEN_REUSE_DETECTED',
  ADMIN_USER_LIST: 'ADMIN_USER_LIST',
  ADMIN_USER_GET: 'ADMIN_USER_GET',
  ADMIN_USER_STATUS_CHANGED: 'ADMIN_USER_STATUS_CHANGED',
  ADMIN_USER_ROLE_CHANGED: 'ADMIN_USER_ROLE_CHANGED',
  ADMIN_USER_DELETED: 'ADMIN_USER_DELETED',
};

export const logAudit = async ({
  userId = null,
  action,
  targetUserId = null,
  requestId = null,
  details = null,
  transaction = null,
}) => {
  try {
    await AuditLog.create(
      {
        userId,
        action,
        targetUserId,
        requestId,
        details,
      },
      { transaction },
    );
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error.message);
  }
};

export default logAudit;