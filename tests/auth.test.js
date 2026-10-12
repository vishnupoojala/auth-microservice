import {
  request,
  env,
  jwt,
  RefreshToken,
  hashRefreshToken,
  prepareTestDatabase,
  resetTestDatabase,
  closeTestDatabase,
  resetRateLimiters,
  createUser,
  uniqueEmail,
  TEST_PASSWORD,
  authHeader,
  signAccessToken,
  registerUser,
  loginUser,
  refreshToken,
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

describe('Registration', () => {
  test('creates a USER account and never returns the password hash', async () => {
    const res = await registerUser({
      name: 'Vishnu',
      email: 'vishnu@example.com',
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Vishnu',
      email: 'vishnu@example.com',
      role: 'USER',
      isActive: true,
    });
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(TEST_PASSWORD);
  });

  test('rejects an invalid email address', async () => {
    const res = await registerUser({
      name: 'Vishnu',
      email: 'not-an-email',
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a weak password', async () => {
    const res = await registerUser({
      name: 'Vishnu',
      email: uniqueEmail(),
      password: 'weak',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a duplicate email with a conflict', async () => {
    const email = uniqueEmail();
    await registerUser({ name: 'Vishnu', email, password: TEST_PASSWORD });
    const res = await registerUser({ name: 'Vishnu', email, password: TEST_PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('prevents public registration from assigning the ADMIN role', async () => {
    const res = await registerUser({
      name: 'Vishnu',
      email: uniqueEmail(),
      password: TEST_PASSWORD,
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects missing required fields', async () => {
    const res = await request.post('/api/v1/auth/register').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Login', () => {
  test('logs in with valid credentials and returns a token pair', async () => {
    await createUser({ email: 'login@test.com' });
    const res = await loginUser({ email: 'login@test.com', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects an incorrect password with a generic error', async () => {
    await createUser({ email: 'login2@test.com' });
    const res = await loginUser({ email: 'login2@test.com', password: 'WrongPassword123!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects an unknown email without revealing it does not exist', async () => {
    const res = await loginUser({ email: 'nobody@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rejects a disabled account', async () => {
    await createUser({ email: 'disabled@test.com', isActive: false });
    const res = await loginUser({ email: 'disabled@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  test('rejects missing fields', async () => {
    const res = await request.post('/api/v1/auth/login').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });
});

describe('JWT authentication', () => {
  test('accepts a valid access token', async () => {
    const user = await createUser();
    const token = signAccessToken(user);
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  test('rejects a missing token', async () => {
    const res = await request.get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('rejects a malformed token', async () => {
    const res = await request.get('/api/v1/users/me').set(authHeader('not-a-jwt'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects a token with an invalid signature', async () => {
    const user = await createUser();
    const token = jwt.sign(
      { role: 'USER' },
      'a'.repeat(40),
      { subject: user.id, issuer: env.jwt.issuer, audience: env.jwt.audience, expiresIn: '15m' },
    );
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects an expired token', async () => {
    const user = await createUser();
    const token = signAccessToken(user, { expiresIn: -10 });
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('rejects a token with an invalid issuer', async () => {
    const user = await createUser();
    const token = jwt.sign(
      { role: 'USER' },
      env.jwt.accessSecret,
      { subject: user.id, issuer: 'someone-else', audience: env.jwt.audience, expiresIn: '15m' },
    );
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects a token with an invalid audience', async () => {
    const user = await createUser();
    const token = jwt.sign(
      { role: 'USER' },
      env.jwt.accessSecret,
      { subject: user.id, issuer: env.jwt.issuer, audience: 'someone-else', expiresIn: '15m' },
    );
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('rejects a non-Bearer authorization scheme', async () => {
    const user = await createUser();
    const token = signAccessToken(user);
    const res = await request.get('/api/v1/users/me').set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('rejects a token whose user has been disabled', async () => {
    const user = await createUser();
    const token = signAccessToken(user);
    user.isActive = false;
    await user.save();
    const res = await request.get('/api/v1/users/me').set(authHeader(token));
    expect(res.status).toBe(401);
  });
});

describe('Refresh token rotation', () => {
  const loginFreshUser = async () => {
    const user = await createUser({ email: uniqueEmail() });
    const res = await loginUser({ email: user.email, password: TEST_PASSWORD });
    return { user, ...res.body.data };
  };

  test('issues a new token pair and rotates the refresh token', async () => {
    const { refreshToken: first } = await loginFreshUser();
    const res = await refreshToken(first);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.refreshToken).not.toBe(first);

    const reuse = await refreshToken(first);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  test('rejects an expired refresh token', async () => {
    const { refreshToken: raw } = await loginFreshUser();
    const record = await RefreshToken.findOne({ where: { tokenHash: hashRefreshToken(raw) } });
    record.expiresAt = new Date(Date.now() - 1000);
    await record.save();

    const res = await refreshToken(raw);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  test('rejects a revoked refresh token and revokes the token family on reuse', async () => {
    const { refreshToken: first } = await loginFreshUser();
    const rotated = await refreshToken(first);
    const second = rotated.body.data.refreshToken;

    const reuse = await refreshToken(first);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REVOKED');

    const family = await refreshToken(second);
    expect(family.status).toBe(401);
    expect(family.body.error.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  test('rejects an access token supplied as a refresh token', async () => {
    const { accessToken } = await loginFreshUser();
    const res = await refreshToken(accessToken);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('handles concurrent refresh attempts safely (one succeeds)', async () => {
    const { refreshToken: raw } = await loginFreshUser();
    const [a, b] = await Promise.all([refreshToken(raw), refreshToken(raw)]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 401]);
  });
});

describe('Logout', () => {
  test('revokes the supplied refresh token', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const { accessToken, refreshToken: refresh } = login.body.data;

    const res = await request
      .post('/api/v1/auth/logout')
      .set(authHeader(accessToken))
      .send({ refreshToken: refresh });
    expect(res.status).toBe(200);

    const reuse = await refreshToken(refresh);
    expect(reuse.status).toBe(401);
  });

  test('revokes every refresh token when none is supplied', async () => {
    const user = await createUser();
    const first = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const second = await loginUser({ email: user.email, password: TEST_PASSWORD });

    const res = await request
      .post('/api/v1/auth/logout')
      .set(authHeader(first.body.data.accessToken))
      .send({});
    expect(res.status).toBe(200);

    expect((await refreshToken(first.body.data.refreshToken)).status).toBe(401);
    expect((await refreshToken(second.body.data.refreshToken)).status).toBe(401);
  });

  test('requires authentication', async () => {
    const res = await request.post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(401);
  });

  test('leaves the already-issued access token usable until it expires', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const { accessToken } = login.body.data;

    await request.post('/api/v1/auth/logout').set(authHeader(accessToken)).send({});
    const res = await request.get('/api/v1/users/me').set(authHeader(accessToken));
    expect(res.status).toBe(200);
  });
});

describe('Change password', () => {
  test('changes the password and revokes existing sessions', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const { accessToken, refreshToken: refresh } = login.body.data;
    const newPassword = 'BrandNewPassword456!';

    const res = await request
      .post('/api/v1/auth/change-password')
      .set(authHeader(accessToken))
      .send({ currentPassword: TEST_PASSWORD, newPassword });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(newPassword);

    expect((await refreshToken(refresh)).status).toBe(401);

    const oldLogin = await loginUser({ email: user.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await loginUser({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  test('rejects an incorrect current password', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const res = await request
      .post('/api/v1/auth/change-password')
      .set(authHeader(login.body.data.accessToken))
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'BrandNewPassword456!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('rejects a weak new password', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const res = await request
      .post('/api/v1/auth/change-password')
      .set(authHeader(login.body.data.accessToken))
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a missing current password', async () => {
    const user = await createUser();
    const login = await loginUser({ email: user.email, password: TEST_PASSWORD });
    const res = await request
      .post('/api/v1/auth/change-password')
      .set(authHeader(login.body.data.accessToken))
      .send({ newPassword: 'BrandNewPassword456!' });
    expect(res.status).toBe(400);
  });
});
