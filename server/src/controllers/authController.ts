import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middlewares/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-chat-token-key-2026';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Заполните все обязательные поля' });
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: trimmedUsername }, { email: trimmedEmail }],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        res.status(409).json({ message: 'Пользователь с таким логином уже существует' });
        return;
      }
      res.status(409).json({ message: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`;

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        email: trimmedEmail,
        password: hashedPassword,
        avatar,
        status: 'online',
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
    });

    // Automatically join or create general channel if it doesn't exist
    let generalRoom = await prisma.room.findFirst({
      where: { name: 'Общий чат', isGroup: true },
    });

    if (!generalRoom) {
      generalRoom = await prisma.room.create({
        data: {
          name: 'Общий чат',
          isGroup: true,
        },
      });
    }

    await prisma.roomMember.create({
      data: {
        roomId: generalRoom.id,
        userId: user.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user,
      token,
      message: 'Регистрация прошла успешно',
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Ошибка сервера при регистрации' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      res.status(400).json({ message: 'Введите логин/email и пароль' });
      return;
    }

    const trimmedLogin = login.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmedLogin },
          { email: trimmedLogin.toLowerCase() },
        ],
      },
    });

    if (!user) {
      res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update status to online
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: 'online',
        createdAt: user.createdAt,
      },
      token,
      message: 'Вход выполнен успешно',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Ошибка сервера при входе' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Пользователь не авторизован' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
