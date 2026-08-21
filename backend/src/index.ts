import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import folderRoutes from './routes/folders.js';
import messageRoutes from './routes/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Flexible CORS allowing client origins with credentials
app.use(
  cors({
    origin: true,
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

// Serve built frontend assets in production
const clientDist = path.resolve(__dirname, '../public');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

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

const HOST = '0.0.0.0';
app.listen(config.port, HOST, () => {
  console.log(`=========================================`);
  console.log(` Webmail Backend API running on ${HOST}:${config.port}`);
  console.log(` Target IMAP Server: ${config.imap.host}:${config.imap.port}`);
  console.log(` Target SMTP Server: ${config.smtp.host}:${config.smtp.port}`);
  console.log(`=========================================`);
});
