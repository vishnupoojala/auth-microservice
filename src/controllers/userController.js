import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getProfile, updateProfile } from '../services/userService.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await getProfile(req.user.id);
  ok(res, { user }, 'Profile retrieved successfully');
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, {
    name: req.body.name,
    email: req.body.email,
  });
  ok(res, { user }, 'Profile updated successfully');
});

export default { getMe, updateMe };