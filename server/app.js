import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import gameRouter from './routes/game.routes.js';
import leaderboardRouter from './routes/leaderboard.routes.js';

import { SuccessResponse } from './utils/apiResponse.js';
import {
  notFoundHandler,
  globalErrorHandler
} from './middleware/error.middleware.js';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  return new SuccessResponse({
    message: 'Server is healthy.',
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }).send(res);
});

app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/game', gameRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;