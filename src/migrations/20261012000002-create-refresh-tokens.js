export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('refresh_tokens', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    tokenHash: {
      type: Sequelize.STRING(64),
      allowNull: false,
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    replacedByTokenId: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('refresh_tokens', ['tokenHash'], {
    name: 'refresh_tokens_token_hash_unique',
    unique: true,
  });
  await queryInterface.addIndex('refresh_tokens', ['userId'], {
    name: 'refresh_tokens_user_id_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['expiresAt'], {
    name: 'refresh_tokens_expires_at_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['revokedAt'], {
    name: 'refresh_tokens_revoked_at_idx',
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('refresh_tokens');
}