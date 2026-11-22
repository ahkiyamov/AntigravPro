import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { setupChatSockets } from './sockets/chatSocket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files if present (Fullstack single container deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const altDistPath = path.resolve(__dirname, '../public');
const staticPath = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altDistPath)
  ? altDistPath
  : null;

if (staticPath) {
  app.use(express.static(staticPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

setupChatSockets(io);

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Chat Server is running on http://0.0.0.0:${PORT}`);
});
