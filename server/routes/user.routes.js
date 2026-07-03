import { Router } from 'express';

import { protect } from '../middleware/auth.middleware.js';
import {
  getProfile,
  addFriend
} from '../controllers/user.controller.js';

const userRouter = Router();

userRouter.use(protect);

userRouter.get('/profile', getProfile);
userRouter.post('/friends/add', addFriend);
userRouter.post('/friends/:friendId', addFriend);

export default userRouter;