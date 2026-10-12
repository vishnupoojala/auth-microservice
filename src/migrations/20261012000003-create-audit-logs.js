export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    action: {
      type: Sequelize.STRING(120),
      allowNull: false,
    },
    targetUserId: {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    requestId: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    details: {
      type: Sequelize.JSON,
      allowNull: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('audit_logs', ['userId'], {
    name: 'audit_logs_user_id_idx',
  });
  await queryInterface.addIndex('audit_logs', ['targetUserId'], {
    name: 'audit_logs_target_user_id_idx',
  });
  await queryInterface.addIndex('audit_logs', ['createdAt'], {
    name: 'audit_logs_created_at_idx',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('audit_logs');
}