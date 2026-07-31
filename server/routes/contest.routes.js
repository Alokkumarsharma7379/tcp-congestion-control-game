import { Router } from 'express';

import { protect } from '../middleware/auth.middleware.js';
import {
  createContest,
  getContestByRoomCode,
  getContestResults
} from '../controllers/contest.controller.js';

const contestRouter = Router();

contestRouter.use(protect);

contestRouter.post('/', createContest);
contestRouter.get('/:roomCode', getContestByRoomCode);
contestRouter.get('/:roomCode/results', getContestResults);

export default contestRouter;