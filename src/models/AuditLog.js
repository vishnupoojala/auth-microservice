import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Actor who performed the action; nullable when the actor is unknown',
    },
    action: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    targetUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    requestId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'audit_logs',
    updatedAt: false,
  },
);

export default AuditLog;