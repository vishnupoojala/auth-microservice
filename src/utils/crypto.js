import crypto from 'node:crypto';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

export const hashRefreshToken = (token) => sha256(token);

export const generateRequestId = () => crypto.randomUUID();

export default { sha256, generateRefreshToken, hashRefreshToken, generateRequestId };