import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middlewares/auth.js';
import { saveDeviceToken } from '../services/fcmService.js';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId;
    const { search } = req.query;

    const queryWhere: any = {
      id: { not: currentUserId },
    };

    if (search && typeof search === 'string' && search.trim().length > 0) {
      queryWhere.username = {
        contains: search.trim(),
      };
    }

    const users = await prisma.user.findMany({
      where: queryWhere,
      select: {
        id: true,
        username: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        username: 'asc',
      },
      take: 50,
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
  }
};

export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;

    if (!userId || !token) {
      res.status(400).json({ message: 'Токен устройства не передан' });
      return;
    }

    await saveDeviceToken(userId, token);
    res.json({ success: true, message: 'Токен устройства успешно зарегистрирован' });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ message: 'Ошибка при сохранении токена устройства' });
  }
};
