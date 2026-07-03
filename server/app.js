import express from 'express';
import cors from 'cors';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware.js';

const app = express();

// Global Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Base Routes
app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: 'TCP Edu Platform API is running.' });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Centralized Error Handling (Must be mounted after all routes)
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;