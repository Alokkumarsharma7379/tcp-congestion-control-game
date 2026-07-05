import { Router } from 'express';

import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

import {
  getProfile,
  getPublicProfileByUsername,
  toggleFriend,
  updateAvatar
} from '../controllers/user.controller.js';

const userRouter = Router();

// Authenticated-only routes for the logged-in user's own account.
userRouter.get('/profile', protect, getProfile);
userRouter.post('/avatar', protect, upload.single('avatar'), updateAvatar);

userRouter.post('/friends/add', protect, toggleFriend);
userRouter.post('/friends/:friendId', protect, toggleFriend);

// Public profile lookup — optionalAuth so we can flag `isFriend` when the
// viewer happens to be logged in, without requiring it to view a profile.
// Registered last so it never shadows the literal routes above.
userRouter.get('/:username', optionalAuth, getPublicProfileByUsername);

export default userRouter;