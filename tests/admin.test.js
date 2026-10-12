import {
  request,
  prepareTestDatabase,
  resetTestDatabase,
  closeTestDatabase,
  resetRateLimiters,
  createUser,
  uniqueEmail,
  TEST_PASSWORD,
  authHeader,
  loginUser,
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

const makeAdmin = async () => {
  const user = await createUser({ email: uniqueEmail('admin'), role: 'ADMIN' });
  const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
  return { user, token: login.body.data.accessToken };
};

describe('Admin authorization', () => {
  test('rejects unauthenticated access with 401', async () => {
    const res = await request.get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  test('rejects a standard USER with 403', async () => {
    const user = await createUser({ email: uniqueEmail() });
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const res = await request
      .get('/api/v1/admin/users')
      .set(authHeader(login.body.data.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});

describe('GET /api/v1/admin/users', () => {
  test('lists users with pagination metadata', async () => {
    const { token } = await makeAdmin();
    await createUser({ email: uniqueEmail('a') });
    await createUser({ email: uniqueEmail('b') });

    const res = await request.get('/api/v1/admin/users').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 10 });
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.items[0].passwordHash).toBeUndefined();
  });

  test('applies safe pagination limits', async () => {
    const { token } = await makeAdmin();
    for (let i = 0; i < 5; i += 1) {
      await createUser({ email: uniqueEmail(`u${i}`) });
    }
    const res = await request
      .get('/api/v1/admin/users?page=1&limit=2')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(2);
    expect(res.body.data.pagination.totalPages).toBe(3);
  });

  test('rejects an out-of-range limit', async () => {
    const { token } = await makeAdmin();
    const res = await request
      .get('/api/v1/admin/users?limit=9999')
      .set(authHeader(token));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/users/:id', () => {
  test('returns a single user by UUID', async () => {
    const { token } = await makeAdmin();
    const target = await createUser({ email: uniqueEmail() });
    const res = await request
      .get(`/api/v1/admin/users/${target.id}`)
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(target.id);
  });

  test('rejects an invalid UUID', async () => {
    const { token } = await makeAdmin();
    const res = await request
      .get('/api/v1/admin/users/not-a-uuid')
      .set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 for an unknown UUID', async () => {
    const { token } = await makeAdmin();
    const res = await request
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('PATCH /api/v1/admin/users/:id/status', () => {
  test('disables and re-enables an account', async () => {
    const { token } = await makeAdmin();
    const target = await createUser({ email: uniqueEmail() });

    const disable = await request
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set(authHeader(token))
      .send({ isActive: false });
    expect(disable.status).toBe(200);
    expect(disable.body.data.user.isActive).toBe(false);

    const loginAttempt = await loginUser({ email: target.email, password: TEST_PASSWORD });
    expect(loginAttempt.status).toBe(403);

    const enable = await request
      .patch(`/api/v1/admin/users/${target.id}/status`)
      .set(authHeader(token))
      .send({ isActive: true });
    expect(enable.status).toBe(200);
    expect(enable.body.data.user.isActive).toBe(true);
  });

  test('prevents an admin from disabling their own account', async () => {
    const { user, token } = await makeAdmin();
    const res = await request
      .patch(`/api/v1/admin/users/${user.id}/status`)
      .set(authHeader(token))
      .send({ isActive: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_OPERATION_BLOCKED');
  });

  test('protects the last active administrator (service guard)', async () => {
    const { setUserStatus } = await import('../src/services/userService.js');
    const onlyAdmin = await createUser({ role: 'ADMIN', email: uniqueEmail('only') });
    await expect(
      setUserStatus('11111111-1111-4111-8111-111111111111', onlyAdmin.id, false),
    ).rejects.toMatchObject({ code: 'LAST_ADMIN_PROTECTED' });
  });
});

describe('PATCH /api/v1/admin/users/:id/role', () => {
  test('promotes a user to ADMIN and the new role is enforced from the database', async () => {
    const { token } = await makeAdmin();
    const target = await createUser({ email: uniqueEmail() });
    const targetLogin = await loginUser({ email: target.email, password: TEST_PASSWORD });

    const promote = await request
      .patch(`/api/v1/admin/users/${target.id}/role`)
      .set(authHeader(token))
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.user.role).toBe('ADMIN');

    const access = await request
      .get('/api/v1/admin/users')
      .set(authHeader(targetLogin.body.data.accessToken));
    expect(access.status).toBe(200);
  });

  test('rejects an invalid role value', async () => {
    const { token } = await makeAdmin();
    const target = await createUser({ email: uniqueEmail() });
    const res = await request
      .patch(`/api/v1/admin/users/${target.id}/role`)
      .set(authHeader(token))
      .send({ role: 'SUPERUSER' });
    expect(res.status).toBe(400);
  });

  test('prevents an admin from changing their own role', async () => {
    const { user, token } = await makeAdmin();
    const res = await request
      .patch(`/api/v1/admin/users/${user.id}/role`)
      .set(authHeader(token))
      .send({ role: 'USER' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_OPERATION_BLOCKED');
  });
});

describe('DELETE /api/v1/admin/users/:id', () => {
  test('deletes a user', async () => {
    const { token } = await makeAdmin();
    const target = await createUser({ email: uniqueEmail() });

    const res = await request
      .delete(`/api/v1/admin/users/${target.id}`)
      .set(authHeader(token));
    expect(res.status).toBe(200);

    const loginAttempt = await loginUser({ email: target.email, password: TEST_PASSWORD });
    expect(loginAttempt.status).toBe(401);
  });

  test('prevents an admin from deleting their own account', async () => {
    const { user, token } = await makeAdmin();
    const res = await request
      .delete(`/api/v1/admin/users/${user.id}`)
      .set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_OPERATION_BLOCKED');
  });

  test('returns 404 for an unknown UUID', async () => {
    const { token } = await makeAdmin();
    const res = await request
      .delete('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });
});
