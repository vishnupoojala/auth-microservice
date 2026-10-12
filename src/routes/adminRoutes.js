import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  listUsersValidator,
  userIdParamValidator,
  updateUserStatusValidator,
  updateUserRoleValidator,
} from '../validators/userValidators.js';
import adminController from '../controllers/adminController.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List users with pagination and optional search
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200: { description: Users retrieved successfully }
 *       401: { description: Missing or invalid access token }
 *       403: { description: Requires ADMIN role }
 */
router.get('/', listUsersValidator, validateRequest, adminController.getUsers);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Get a single user by UUID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200: { description: User retrieved successfully }
 *       400: { description: Invalid UUID }
 *       401: { description: Missing or invalid access token }
 *       403: { description: Requires ADMIN role }
 *       404: { description: User not found }
 */
router.get('/:id', userIdParamValidator, validateRequest, adminController.getUser);

/**
 * @swagger
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     summary: Enable or disable a user account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200: { description: User status updated successfully }
 *       400: { description: Invalid request or last-admin protection }
 *       401: { description: Missing or invalid access token }
 *       403: { description: Requires ADMIN role }
 *       404: { description: User not found }
 */
router.patch('/:id/status', updateUserStatusValidator, validateRequest, adminController.changeStatus);

/**
 * @swagger
 * /api/v1/admin/users/{id}/role:
 *   patch:
 *     summary: Change a user's role (USER or ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [USER, ADMIN], example: "ADMIN" }
 *     responses:
 *       200: { description: User role updated successfully }
 *       400: { description: Invalid request or last-admin protection }
 *       401: { description: Missing or invalid access token }
 *       403: { description: Requires ADMIN role }
 *       404: { description: User not found }
 */
router.patch('/:id/role', updateUserRoleValidator, validateRequest, adminController.changeRole);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Permanently delete a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200: { description: User deleted successfully }
 *       400: { description: Invalid request or last-admin protection }
 *       401: { description: Missing or invalid access token }
 *       403: { description: Requires ADMIN role }
 *       404: { description: User not found }
 */
router.delete('/:id', userIdParamValidator, validateRequest, adminController.removeUser);

export default router;