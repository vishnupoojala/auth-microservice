import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const TEST_DB_NAME = 'auth_microservice_test_db';

// Tests default to SQLite so the suite runs anywhere without a database server.
// Set TEST_DB_DIALECT=mysql to run against a real MySQL server using an isolated
// `auth_microservice_test_db` database instead.
const DEFAULT_DIALECT = 'sqlite';

// Unique per test file (each Jest test file evaluates this module fresh).
const DEFAULT_STORAGE = path.join(
  os.tmpdir(),
  `auth-microservice-test-${crypto.randomBytes(8).toString('hex')}.sqlite`,
);

export const TEST_VARS = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_ISSUER: 'auth-microservice-test',
  JWT_AUDIENCE: 'auth-api-test',
  REFRESH_TOKEN_TTL_DAYS: '7',
  BCRYPT_SALT_ROUNDS: '10',
  CORS_ORIGIN: 'http://localhost:5173',
  LOGIN_RATE_LIMIT_MAX: '10',
  LOGIN_RATE_LIMIT_WINDOW_MS: '900000',
  REFRESH_RATE_LIMIT_MAX: '60',
  REFRESH_RATE_LIMIT_WINDOW_MS: '900000',
  API_RATE_LIMIT_MAX: '300',
  API_RATE_LIMIT_WINDOW_MS: '900000',
};

export function resolveTestDatabase() {
  const dialect = (process.env.TEST_DB_DIALECT || DEFAULT_DIALECT).toLowerCase();

  if (dialect === 'mysql') {
    const baseUrl =
      process.env.DATABASE_URL ||
      'mysql://root@127.0.0.1:3306/auth_microservice_db';
    const url = baseUrl.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
    return { dialect: 'mysql', databaseUrl: url, storage: null };
  }

  // Honor an explicit TEST_DB_STORAGE, otherwise use this file's unique path.
  const storage = process.env.TEST_DB_STORAGE || DEFAULT_STORAGE;
  return { dialect: 'sqlite', databaseUrl: null, storage };
}

export function setupTestEnv() {
  const db = resolveTestDatabase();

  const vars = {
    ...TEST_VARS,
    DB_DIALECT: db.dialect,
    DATABASE_URL: db.databaseUrl,
    DB_STORAGE: db.storage,
  };

  Object.entries(vars).forEach(([key, value]) => {
    if (value !== null && value !== undefined) process.env[key] = value;
  });

  return db;
}

export { TEST_DB_NAME };

export default setupTestEnv;
