import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import gameRouter from './routes/game.routes.js';
import leaderboardRouter from './routes/leaderboard.routes.js';
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

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TCP Edu Platform API is running.'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/games', gameRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;