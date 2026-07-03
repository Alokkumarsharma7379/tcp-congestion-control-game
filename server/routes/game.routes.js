import { Router } from 'express';

import { protect } from '../middleware/auth.middleware.js';
import {
  submitScore,
  getHistory
} from '../controllers/game.controller.js';

const gameRouter = Router();

gameRouter.use(protect);

gameRouter.post('/submit', submitScore);
gameRouter.get('/history', getHistory);

export default gameRouter;