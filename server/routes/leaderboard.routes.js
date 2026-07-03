import { Router } from 'express';

import { protect } from '../middleware/auth.middleware.js';
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard
} from '../controllers/leaderboard.controller.js';

const leaderboardRouter = Router();

leaderboardRouter.get('/global', getGlobalLeaderboard);
leaderboardRouter.get('/friends', protect, getFriendsLeaderboard);

export default leaderboardRouter;