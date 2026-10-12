import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const PLACEHOLDER_SECRETS = new Set([
  'replace_with_a_strong_random_secret',
  'replace_with_a_strong_random_secret_at_least_32_chars',
  'your_super_secret_access_token_key_change_me',
  'changeme',
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Config] ${message}`);
  }
}

function readSecret(value, name, { required = true, minLength } = {}) {
  if (!value) {
    if (required) {
      throw new Error(`[Config] Missing required environment variable: ${name}`);
    }
    return null;
  }
  if (PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
    throw new Error(`[Config] ${name} is set to an insecure placeholder value. Generate a strong random secret.`);
  }
  if (minLength && value.length < minLength) {
    throw new Error(`[Config] ${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

function readPositiveInt(value, fallback, name) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    if (value !== undefined && value !== '') {
      throw new Error(`[Config] ${name} must be a positive integer (got "${value}").`);
    }
    return fallback;
  }
  return parsed;
}

const SUPPORTED_DIALECTS = new Set(['mysql', 'sqlite']);
const DB_DIALECT = (process.env.DB_DIALECT || 'mysql').toLowerCase();
assert(
  SUPPORTED_DIALECTS.has(DB_DIALECT),
  `Unsupported DB_DIALECT "${DB_DIALECT}". Use one of: ${[...SUPPORTED_DIALECTS].join(', ')}.`,
);

const isSqlite = DB_DIALECT === 'sqlite';

// MySQL needs a connection string; SQLite uses a file (or ":memory:").
const DATABASE_URL = process.env.DATABASE_URL || null;
assert(
  isSqlite || DATABASE_URL,
  'Missing required environment variable: DATABASE_URL (required for the MySQL dialect)',
);

const DATABASE_STORAGE = process.env.DB_STORAGE || ':memory:';

const ACCESS_SECRET = readSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', {
  minLength: isProduction ? 32 : 16,
});

if (isProduction) {
  assert(
    process.env.CORS_ORIGIN !== '*',
    'In production CORS_ORIGIN must not be "*". Provide an explicit allowed origin.',
  );
}

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  NODE_ENV,
  isProduction,
  isTest,
  port: readPositiveInt(process.env.PORT, 3000, 'PORT'),
  dbDialect: DB_DIALECT,
  databaseUrl: DATABASE_URL,
  databaseStorage: DATABASE_STORAGE,
  jwt: {
    accessSecret: ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    issuer: process.env.JWT_ISSUER || 'auth-microservice',
    audience: process.env.JWT_AUDIENCE || 'auth-api',
  },
  refreshTokenTtlDays: readPositiveInt(process.env.REFRESH_TOKEN_TTL_DAYS, 7, 'REFRESH_TOKEN_TTL_DAYS'),
  bcryptSaltRounds: readPositiveInt(process.env.BCRYPT_SALT_ROUNDS, 12, 'BCRYPT_SALT_ROUNDS'),
  corsOrigins: CORS_ORIGINS,
  rateLimit: {
    loginMax: readPositiveInt(process.env.LOGIN_RATE_LIMIT_MAX, 10, 'LOGIN_RATE_LIMIT_MAX'),
    loginWindowMs: readPositiveInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'LOGIN_RATE_LIMIT_WINDOW_MS'),
    refreshMax: readPositiveInt(process.env.REFRESH_RATE_LIMIT_MAX, 60, 'REFRESH_RATE_LIMIT_MAX'),
    refreshWindowMs: readPositiveInt(process.env.REFRESH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'REFRESH_RATE_LIMIT_WINDOW_MS'),
    apiMax: readPositiveInt(process.env.API_RATE_LIMIT_MAX, 300, 'API_RATE_LIMIT_MAX'),
    apiWindowMs: readPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'API_RATE_LIMIT_WINDOW_MS'),
  },
  admin: {
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
};

export default env;