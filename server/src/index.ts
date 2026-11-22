import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';

import { prisma } from './prisma.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { setupChatSockets } from './sockets/chatSocket.js';

dotenv.config();

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
const publicDir = path.resolve(process.cwd(), 'public');
const clientDistDir = path.resolve(process.cwd(), '../client/dist');
const staticPath = fs.existsSync(publicDir)
  ? publicDir
  : fs.existsSync(clientDistDir)
  ? clientDistDir
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

// Auto-seed initial users if DB is brand new/empty
async function autoSeed() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('Database is empty. Auto-seeding initial users...');
      const pHash = await bcrypt.hash('password123', 10);
      const aHash = await bcrypt.hash('albert', 10);

      const albert = await prisma.user.create({
        data: {
          username: 'albert',
          email: 'ah@mail.ru',
          password: aHash,
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=albert',
          status: 'offline',
        },
      });

      const alex = await prisma.user.create({
        data: {
          username: 'alex',
          email: 'alex@example.com',
          password: pHash,
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
          status: 'offline',
        },
      });

      const maria = await prisma.user.create({
        data: {
          username: 'maria',
          email: 'maria@example.com',
          password: pHash,
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=maria',
          status: 'offline',
        },
      });

      let general = await prisma.room.findFirst({
        where: { name: 'Общий чат', isGroup: true },
      });
      if (!general) {
        general = await prisma.room.create({
          data: { name: 'Общий чат', isGroup: true },
        });
      }

      for (const u of [albert, alex, maria]) {
        await prisma.roomMember.create({
          data: { roomId: general.id, userId: u.id },
        });
      }

      await prisma.message.create({
        data: {
          roomId: general.id,
          senderId: alex.id,
          content: 'Всем привет! Добро пожаловать в наш облачный чат! 🚀',
        },
      });

      console.log('Auto-seed completed: albert, alex, maria created.');
    }
  } catch (err) {
    console.error('Auto-seed error:', err);
  }
}

server.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`🚀 Chat Server is running on http://0.0.0.0:${PORT}`);
  await autoSeed();
});
