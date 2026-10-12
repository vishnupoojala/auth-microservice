import User from './User.js';
import RefreshToken from './RefreshToken.js';
import AuditLog from './AuditLog.js';

User.hasMany(RefreshToken, {
  foreignKey: 'userId',
  as: 'refreshTokens',
  onDelete: 'CASCADE',
});

RefreshToken.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

User.hasMany(AuditLog, {
  foreignKey: 'userId',
  as: 'auditLogs',
  onDelete: 'SET NULL',
});

AuditLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'actor',
});

AuditLog.belongsTo(User, {
  foreignKey: 'targetUserId',
  as: 'targetUser',
});

export { User, RefreshToken, AuditLog };