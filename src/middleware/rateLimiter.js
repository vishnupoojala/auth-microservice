import { rateLimit, MemoryStore } from 'express-rate-limit';
import env from '../config/environment.js';
import ApiError from '../utils/ApiError.js';

const buildHandler = () => () => {
  throw ApiError.tooManyRequests(
    'Too many requests, please try again later',
    'RATE_LIMITED',
  );
};

const makeLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: buildHandler(),
    validate: {
      xForwardedForHeader: false,
      trustProxy: false,
    },
    store: new MemoryStore(),
  });

const loginStore = new MemoryStore();
const refreshStore = new MemoryStore();
const apiStore = new MemoryStore();

export const loginLimiter = rateLimit({
  windowMs: env.rateLimit.loginWindowMs,
  limit: env.rateLimit.loginMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: buildHandler(),
  validate: { xForwardedForHeader: false, trustProxy: false },
  store: loginStore,
});

export const refreshLimiter = rateLimit({
  windowMs: env.rateLimit.refreshWindowMs,
  limit: env.rateLimit.refreshMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: buildHandler(),
  validate: { xForwardedForHeader: false, trustProxy: false },
  store: refreshStore,
});

export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.apiWindowMs,
  limit: env.rateLimit.apiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: buildHandler(),
  validate: { xForwardedForHeader: false, trustProxy: false },
  store: apiStore,
});

export const resetRateLimiters = () => {
  loginStore.resetAll();
  refreshStore.resetAll();
  apiStore.resetAll();
};

export { makeLimiter };

export default { loginLimiter, refreshLimiter, apiLimiter, resetRateLimiters };