import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import env from './config/environment.js';
import routes from './routes/index.js';
import swaggerSpec from './docs/swagger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { apiLimiter, resetRateLimiters } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(requestIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use('/api/v1', apiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export { resetRateLimiters };
export default app;