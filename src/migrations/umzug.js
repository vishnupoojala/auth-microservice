import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Umzug, SequelizeStorage } from 'umzug';

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function createUmzug(sequelize) {
  if (!sequelize || !sequelize.getQueryInterface) {
    throw new Error('[Migrations] A Sequelize instance is required.');
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js') && file !== 'umzug.js')
    .sort();

  const migrations = await Promise.all(
    files.map(async (file) => {
      const mod = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
      return {
        name: file,
        up: async () => {
          await mod.up(sequelize.getQueryInterface(), sequelize.Sequelize);
          console.log(`  applied: ${file}`);
        },
        down: async () => {
          await mod.down(sequelize.getQueryInterface(), sequelize.Sequelize);
          console.log(`  reverted: ${file}`);
        },
      };
    }),
  );

  return new Umzug({
    migrations,
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, modelName: 'SequelizeMeta' }),
    logger: console,
  });
}

export { MIGRATIONS_DIR };