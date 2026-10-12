import { body, param, query } from 'express-validator';

export const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be between 2 and 120 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),
];

export const userIdParamValidator = [
  param('id')
    .isUUID(4)
    .withMessage('User id must be a valid UUID'),
];

export const listUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('search must be at most 100 characters'),
];

export const updateUserStatusValidator = [
  param('id').isUUID(4).withMessage('User id must be a valid UUID'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean (true or false)'),
];

export const updateUserRoleValidator = [
  param('id').isUUID(4).withMessage('User id must be a valid UUID'),
  body('role')
    .isIn(['USER', 'ADMIN'])
    .withMessage('role must be either USER or ADMIN'),
];

export default {
  updateProfileValidator,
  userIdParamValidator,
  listUsersValidator,
  updateUserStatusValidator,
  updateUserRoleValidator,
};