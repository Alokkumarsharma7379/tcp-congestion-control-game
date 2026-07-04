import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

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

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;