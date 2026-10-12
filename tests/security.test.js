import {
  request,
  env,
  prepareTestDatabase,
  resetTestDatabase,
  closeTestDatabase,
  resetRateLimiters,
  registerUser,
  loginUser,
  TEST_PASSWORD,
} from './helpers/index.js';

beforeAll(async () => {
  await prepareTestDatabase();
});

beforeEach(async () => {
  resetRateLimiters();
  await resetTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe('Security headers', () => {
  test('sets Helmet security headers and hides x-powered-by', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('returns a request id header and echoes a valid client request id', async () => {
    const generated = await request.get('/health');
    expect(generated.headers['x-request-id']).toBeTruthy();

    const echoed = await request.get('/health').set('X-Request-Id', 'trace-abc-123');
    expect(echoed.headers['x-request-id']).toBe('trace-abc-123');
  });
});

describe('CORS', () => {
  test('allows a configured origin', async () => {
    const res = await request
      .get('/health')
      .set('Origin', env.corsOrigins[0]);
    expect(res.headers['access-control-allow-origin']).toBe(env.corsOrigins[0]);
  });

  test('does not allow an unconfigured origin', async () => {
    const res = await request
      .get('/health')
      .set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Error handling', () => {
  test('returns a consistent 404 body for unknown routes', async () => {
    const res = await request.get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  test('rejects malformed JSON bodies with 400', async () => {
    const res = await request
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  test('never exposes secrets or hashes in responses', async () => {
    const res = await registerUser({
      name: 'Secret Test',
      email: 'secret@test.com',
      password: TEST_PASSWORD,
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('$2a$');
    expect(serialized).not.toContain('$2b$');
  });
});

describe('Rate limiting', () => {
  test('blocks login attempts after the configured maximum', async () => {
    const max = env.rateLimit.loginMax;
    for (let i = 0; i < max; i += 1) {
      const res = await loginUser({ email: 'nobody@test.com', password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
    }
    const blocked = await loginUser({ email: 'nobody@test.com', password: 'WrongPassword123!' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('API documentation', () => {
  test('serves the OpenAPI document', async () => {
    const res = await request.get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.paths['/api/v1/auth/login']).toBeDefined();
    expect(res.body.paths['/api/v1/admin/users']).toBeDefined();
  });

  test('serves the Swagger UI', async () => {
    const res = await request.get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger');
  });
});
