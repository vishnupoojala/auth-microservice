import { generateRequestId } from '../utils/crypto.js';

export const requestIdMiddleware = (req, res, next) => {
  const headerId = req.headers['x-request-id'];
  req.id = headerId && /^[a-zA-Z0-9-]{1,64}$/.test(headerId) ? headerId : generateRequestId();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export default requestIdMiddleware;