import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middlewares/auth.js';

export const getRooms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }

    const memberships = await prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                    status: true,
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format rooms for frontend
    const rooms = memberships.map((membership) => {
      const room = membership.room;
      let displayName = room.name || 'Беседа';
      let displayAvatar = null;
      let otherUserStatus = null;
      let otherUserId = null;

      if (!room.isGroup) {
        const otherMember = room.members.find((m) => m.userId !== userId);
        if (otherMember) {
          displayName = otherMember.user.username;
          displayAvatar = otherMember.user.avatar;
          otherUserStatus = otherMember.user.status;
          otherUserId = otherMember.user.id;
        }
      }

      return {
        id: room.id,
        name: displayName,
        isGroup: room.isGroup,
        avatar: displayAvatar,
        otherUserId,
        otherUserStatus,
        membersCount: room.members.length,
        lastMessage: room.messages[0] || null,
        updatedAt: room.messages[0]?.createdAt || room.createdAt,
      };
    });

    // Sort by most recent activity
    rooms.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    res.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Ошибка при получении списка чатов' });
  }
};

export const getRoomMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;

    // Verify membership
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: userId!,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ message: 'У вас нет доступа к этой комнате' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // latest 100 messages
    });

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Ошибка при получении сообщений' });
  }
};

export const createDirectRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId;
    const { targetUserId } = req.body;

    if (!targetUserId || !currentUserId) {
      res.status(400).json({ message: 'Не указан получатель' });
      return;
    }

    if (targetUserId === currentUserId) {
      res.status(400).json({ message: 'Нельзя создать диалог с самим собой' });
      return;
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }

    // Check if direct room already exists between these 2 users
    const existingRooms = await prisma.room.findMany({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: true,
      },
    });

    if (existingRooms.length > 0) {
      const room = existingRooms[0];
      res.json({
        roomId: room.id,
        isNew: false,
        name: targetUser.username,
        avatar: targetUser.avatar,
      });
      return;
    }

    // Create new direct room
    const newRoom = await prisma.room.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { userId: currentUserId },
            { userId: targetUserId },
          ],
        },
      },
    });

    res.status(201).json({
      roomId: newRoom.id,
      isNew: true,
      name: targetUser.username,
      avatar: targetUser.avatar,
    });
  } catch (error) {
    console.error('Error creating direct room:', error);
    res.status(500).json({ message: 'Ошибка при создании диалога' });
  }
};

export const createGroupRoom = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId;
    const { name, participantIds } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Укажите название группы' });
      return;
    }

    const uniqueParticipantIds = Array.from(
      new Set([currentUserId!, ...(Array.isArray(participantIds) ? participantIds : [])])
    );

    const newRoom = await prisma.room.create({
      data: {
        name: name.trim(),
        isGroup: true,
        members: {
          create: uniqueParticipantIds.map((uId) => ({ userId: uId })),
        },
      },
    });

    res.status(201).json({
      roomId: newRoom.id,
      name: newRoom.name,
      isGroup: true,
    });
  } catch (error) {
    console.error('Error creating group room:', error);
    res.status(500).json({ message: 'Ошибка при создании группы' });
  }
};
