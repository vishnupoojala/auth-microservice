import {
  request,
  prepareTestDatabase,
  resetTestDatabase,
  closeTestDatabase,
  resetRateLimiters,
  createUser,
  uniqueEmail,
  authHeader,
  signAccessToken,
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

describe('GET /api/v1/users/me', () => {
  test('returns the authenticated user profile without sensitive fields', async () => {
    const user = await createUser({ name: 'Vishnu', email: 'profile@test.com' });
    const res = await request.get('/api/v1/users/me').set(authHeader(signAccessToken(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      id: user.id,
      name: 'Vishnu',
      email: 'profile@test.com',
      role: 'USER',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('requires a valid access token', async () => {
    const res = await request.get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/users/me', () => {
  test('updates permitted fields', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Updated Name');
  });

  test('normalizes an updated email to lowercase', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ email: 'MixedCase@Example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('mixedcase@example.com');
  });

  test('cannot change its own role (privilege escalation attempt)', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ name: 'Still A User', role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('USER');
  });

  test('cannot change protected account fields such as isActive', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ name: 'Safe', isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(true);
  });

  test('rejects an empty update', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOTHING_TO_UPDATE');
  });

  test('rejects an invalid email', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('rejects a duplicate email with a conflict', async () => {
    const taken = await createUser({ email: uniqueEmail('taken') });
    const user = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch('/api/v1/users/me')
      .set(authHeader(signAccessToken(user)))
      .send({ email: taken.email });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('cannot access another user private data', async () => {
    const other = await createUser({ email: uniqueEmail('other') });
    const user = await createUser({ email: uniqueEmail('me') });
    const res = await request.get('/api/v1/users/me').set(authHeader(signAccessToken(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.id).not.toBe(other.id);
  });

  test('requires a valid access token', async () => {
    const res = await request.patch('/api/v1/users/me').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });
});
