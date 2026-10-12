import { body } from 'express-validator';

const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 72,
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
  message:
    'Password must be 8-72 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character',
};

export const PASSWORD_POLICY_RULES = PASSWORD_POLICY;

export const validatePassword = (value) => {
  if (!value) return value;
  if (
    value.length < PASSWORD_POLICY.minLength ||
    value.length > PASSWORD_POLICY.maxLength ||
    !PASSWORD_POLICY.pattern.test(value)
  ) {
    throw new Error(PASSWORD_POLICY.message);
  }
  return value;
};

const emailChain = () => body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail();

export const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters'),
  emailChain(),
  body('password').isString().withMessage('Password is required').custom(validatePassword),
  body('role')
    .optional()
    .custom((value) => {
      if (String(value).toUpperCase() !== 'USER') {
        throw new Error('Role cannot be assigned during registration');
      }
      return true;
    }),
];

export const loginValidator = [
  emailChain(),
  body('password').isString().withMessage('Password is required').notEmpty().withMessage('Password is required'),
];

export const refreshValidator = [
  body('refreshToken').isString().withMessage('refreshToken is required').notEmpty().withMessage('refreshToken is required'),
];

export const logoutValidator = [
  body('refreshToken').optional().isString().withMessage('refreshToken must be a string'),
];

export const changePasswordValidator = [
  body('currentPassword').isString().withMessage('currentPassword is required').notEmpty().withMessage('currentPassword is required'),
  body('newPassword').isString().withMessage('newPassword is required').custom(validatePassword),
];

export default {
  registerValidator,
  loginValidator,
  refreshValidator,
  logoutValidator,
  changePasswordValidator,
  validatePassword,
  PASSWORD_POLICY_RULES,
};