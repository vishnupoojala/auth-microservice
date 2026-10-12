import bcrypt from 'bcryptjs';

export const TEST_PASSWORD = 'StrongPassword123!';

let counter = 0;

export const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}${counter++}@test.com`;

export const strongPassword = () => TEST_PASSWORD;

export const weakPassword = () => 'weak';

export async function createUser({
  name = 'Test User',
  email,
  password = TEST_PASSWORD,
  role = 'USER',
  isActive = true,
} = {}) {
  const { default: User } = await import('../../src/models/User.js');
  const user = await User.create({
    name,
    email: email || uniqueEmail(),
    passwordHash: await bcrypt.hash(password, 10),
    role,
    isActive,
  });
  return user;
}

export async function loginViaApi(request, email, password = TEST_PASSWORD) {
  const res = await request.post('/api/v1/auth/login').send({ email, password });
  return res.body.data || null;
}

export async function registerViaApi(request, overrides = {}) {
  const payload = {
    name: 'Vishnu',
    email: uniqueEmail(),
    password: TEST_PASSWORD,
    ...overrides,
  };
  const res = await request.post('/api/v1/auth/register').send(payload);
  return res;
}

export default {
  TEST_PASSWORD,
  uniqueEmail,
  strongPassword,
  weakPassword,
  createUser,
  loginViaApi,
  registerViaApi,
};