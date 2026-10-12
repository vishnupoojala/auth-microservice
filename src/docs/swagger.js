import swaggerJsdoc from 'swagger-jsdoc';
import env from '../config/environment.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Role-Based Authentication Microservice',
      version: '1.0.0',
      description:
        'Production-style authentication microservice with JWT access tokens, refresh-token rotation, role-based access control (USER / ADMIN), profile management and administrative user management.',
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Registration, login, tokens, logout, password' },
      { name: 'Users', description: 'Authenticated user profile endpoints' },
      { name: 'Admin', description: 'Administrative user management' },
      { name: 'System', description: 'Health and documentation' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;