import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginLimiter, refreshLimiter } from '../middleware/rateLimiter.js';
import {
  registerValidator,
  loginValidator,
  refreshValidator,
  logoutValidator,
  changePasswordValidator,
} from '../validators/authValidators.js';
import authController from '../controllers/authController.js';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new standard user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Vishnu" }
 *               email: { type: string, example: "vishnu@example.com" }
 *               password: { type: string, example: "StrongPassword123!" }
 *               role: { type: string, example: "USER" }
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already exists
 */
router.post('/register', registerValidator, validateRequest, authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in and receive access + refresh tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "vishnu@example.com" }
 *               password: { type: string, example: "StrongPassword123!" }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account disabled
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/login', loginLimiter, loginValidator, validateRequest, authController.login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Rotate a refresh token and receive a new token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, description: "The last issued refresh token", example: "..." }
 *     responses:
 *       200:
 *         description: Tokens refreshed
 *       401:
 *         description: Invalid, expired or revoked refresh token
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/refresh', refreshLimiter, refreshValidator, validateRequest, authController.refresh);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Revoke a refresh token (or all of the user's refresh tokens)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: "Optional. If provided, only this token is revoked." }
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Missing or invalid access token
 */
router.post('/logout', authenticate, logoutValidator, validateRequest, authController.logout);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change the authenticated user's password (revokes all sessions)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: "StrongPassword123!" }
 *               newPassword: { type: string, example: "NewStrongPassword456!" }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid new password or incorrect current password
 *       401:
 *         description: Missing or invalid access token
 */
router.post(
  '/change-password',
  authenticate,
  changePasswordValidator,
  validateRequest,
  authController.changeUserPassword,
);

export default router;