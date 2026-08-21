import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import folderRoutes from './routes/folders.js';
import messageRoutes from './routes/messages.js';

const app = express();

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    imapHost: config.imap.host,
    smtpHost: config.smtp.host,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/messages', messageRoutes);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Express Error]', err);
  res.status(500).json({ message: err?.message || 'Internal Server Error' });
});

// Global process resilience against network socket drops
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(` Webmail Backend API running on port ${config.port}`);
  console.log(` Target IMAP Server: ${config.imap.host}:${config.imap.port}`);
  console.log(` Target SMTP Server: ${config.smtp.host}:${config.smtp.port}`);
  console.log(`=========================================`);
});
