import env from './config/environment.js';
import { testConnection } from './config/database.js';
import app from './app.js';

async function start() {
  await testConnection();
  const server = app.listen(env.port, () => {
    console.log(`Auth microservice running in ${env.NODE_ENV} mode`);
    console.log(`  - API base:   http://localhost:${env.port}/api/v1`);
    console.log(`  - Swagger UI: http://localhost:${env.port}/api-docs`);
    console.log(`  - Health:     http://localhost:${env.port}/health`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});