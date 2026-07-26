import { Router } from 'express';

import { protect } from '../middleware/auth.middleware.js';
import { getConversations, getDirectHistory } from '../controllers/message.controller.js';

const messageRouter = Router();

messageRouter.use(protect);

messageRouter.get('/conversations', getConversations);
messageRouter.get('/direct/:userId', getDirectHistory);

export default messageRouter;