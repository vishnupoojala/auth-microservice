import { Sequelize } from 'sequelize';
import env from './environment.js';

const define = {
  underscored: false,
  freezeTableName: true,
};

const buildSequelize = () => {
  if (env.dbDialect === 'sqlite') {
    return new Sequelize({
      dialect: 'sqlite',
      storage: env.databaseStorage,
      logging: false,
      define,
      pool: { max: 1, min: 0, idle: Infinity },
    });
  }

  return new Sequelize(env.databaseUrl, {
    dialect: 'mysql',
    logging: false,
    define,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
};

const sequelize = buildSequelize();

export const testConnection = async () => {
  await sequelize.authenticate();
};

export default sequelize;
