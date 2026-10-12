import fs from 'node:fs';
import path from 'node:path';
import { setupTestEnv } from './testEnv.js';

async function getSequelize() {
  const { default: sequelize } = await import('../../src/config/database.js');
  return sequelize;
}

export async function ensureTestDatabase() {
  const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

  if (dialect === 'sqlite') {
    const storage = process.env.DB_STORAGE;
    if (storage && storage !== ':memory:') {
      fs.mkdirSync(path.dirname(storage), { recursive: true });
      if (fs.existsSync(storage)) {
        try {
          fs.rmSync(storage);
        } catch {
          // The file may still be locked by another suite; reuse it instead.
        }
      }
    }
    return;
  }

  // MySQL: create an isolated test database if it does not already exist.
  const mysqlModule = await import('mysql2/promise');
  const mysql = mysqlModule.default;
  const baseUrl = process.env.DATABASE_URL;
  const url = new URL(baseUrl);

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${url.pathname.slice(1)}\``);
  } finally {
    await connection.end();
  }
}

export async function prepareTestDatabase() {
  setupTestEnv();
  await ensureTestDatabase();

  const sequelize = await getSequelize();
  await sequelize.authenticate();

  const { createUmzug } = await import('../../src/migrations/umzug.js');
  const umzug = await createUmzug(sequelize);
  await umzug.up();
}

export async function resetTestDatabase() {
  const sequelize = await getSequelize();
  await sequelize.query('DELETE FROM audit_logs');
  await sequelize.query('DELETE FROM refresh_tokens');
  await sequelize.query('DELETE FROM users');
}

export async function closeTestDatabase() {
  const sequelize = await getSequelize();
  if (sequelize.isOpen) {
    await sequelize.close();
  }

  if ((process.env.DB_DIALECT || 'sqlite') === 'sqlite') {
    const storage = process.env.DB_STORAGE;
    if (storage && storage !== ':memory:' && fs.existsSync(storage)) {
      try {
        fs.rmSync(storage);
      } catch {
        // Best-effort cleanup; leftover temp files are harmless.
      }
    }
  }
}

export default { prepareTestDatabase, resetTestDatabase, closeTestDatabase };
