import { setupTestEnv } from './testEnv.js';

setupTestEnv();

const [{ default: app }, supertestModule] = await Promise.all([
  import('../../src/app.js'),
  import('supertest'),
]);

const request = supertestModule.default(app);

export { app, request };
export default request;