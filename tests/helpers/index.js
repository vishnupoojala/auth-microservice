import { setupTestEnv } from './testEnv.js';

setupTestEnv();

import jwt from 'jsonwebtoken';

const envModule = await import('../../src/config/environment.js');
const appModule = await import('../../src/app.js');
const supertestModule = await import('supertest');
const rateLimiterModule = await import('../../src/middleware/rateLimiter.js');
const dbModule = await import('./db.js');
const factoryModule = await import('./factory.js');
const modelsModule = await import('../../src/models/index.js');
const cryptoModule = await import('../../src/utils/crypto.js');

export const env = envModule.default;
export const app = appModule.default;
export const request = supertestModule.default(app);
export const resetRateLimiters = rateLimiterModule.resetRateLimiters;

export const prepareTestDatabase = dbModule.prepareTestDatabase;
export const resetTestDatabase = dbModule.resetTestDatabase;
export const closeTestDatabase = dbModule.closeTestDatabase;

export const { User, RefreshToken, AuditLog } = modelsModule;
export const { hashRefreshToken } = cryptoModule;

export const {
  TEST_PASSWORD,
  uniqueEmail,
  strongPassword,
  weakPassword,
  createUser,
  loginViaApi,
  registerViaApi,
} = factoryModule;

export const signAccessToken = (user, overrides = {}) =>
  jwt.sign(
    { role: user.role ?? 'USER' },
    env.jwt.accessSecret,
    {
      subject: String(user.id),
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: '15m',
      algorithm: 'HS256',
      ...overrides,
    },
  );

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const registerUser = (payload) =>
  request.post('/api/v1/auth/register').send(payload);

export const loginUser = (payload) =>
  request.post('/api/v1/auth/login').send(payload);

export const refreshToken = (refreshTokenValue) =>
  request.post('/api/v1/auth/refresh').send({ refreshToken: refreshTokenValue });

export { jwt };
