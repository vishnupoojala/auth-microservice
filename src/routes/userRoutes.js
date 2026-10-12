import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { updateProfileValidator } from '../validators/userValidators.js';
import userController from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Missing or invalid access token
 */
router.get('/me', userController.getMe);

/**
 * @swagger
 * /api/v1/users/me:
 *   patch:
 *     summary: Update the authenticated user's profile (name and email only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Vishnu Updated" }
 *               email: { type: string, example: "vishnu.new@example.com" }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Missing or invalid access token
 *       409:
 *         description: Email already in use
 */
router.patch('/me', updateProfileValidator, validateRequest, userController.updateMe);

export default router;