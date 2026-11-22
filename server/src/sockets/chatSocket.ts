import { Server, Socket } from 'socket.io';
import { verifySocketToken } from '../middlewares/auth.js';
import { prisma } from '../prisma.js';
import { sendPushToUsers } from '../services/fcmService.js';

// userId -> Set of active socket ids
const onlineUsers = new Map<string, Set<string>>();

export const setupChatSockets = (io: Server) => {
  // Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const payload = verifySocketToken(token);
    if (!payload) {
      return next(new Error('Authentication error: Invalid token'));
    }

    socket.data.userId = payload.userId;
    socket.data.username = payload.username;
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    // Track online user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      // First connection for this user - mark as online in DB & broadcast
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'online' },
      }).catch(() => {});

      io.emit('user_status_changed', { userId, status: 'online' });
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Send currently online user IDs to the connected client
    socket.emit('online_users_list', Array.from(onlineUsers.keys()));

    // Join room
    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
    });

    // Leave room
    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
    });

    // Handle new message
    socket.on('send_message', async (data: { roomId: string; content?: string; imageUrl?: string; audioUrl?: string }) => {
      try {
        const { roomId, content = '', imageUrl, audioUrl } = data;
        if (!content.trim() && !imageUrl && !audioUrl) return;

        // Verify membership
        const member = await prisma.roomMember.findUnique({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        if (!member) {
          socket.emit('error', { message: 'Вы не состоите в этом чате' });
          return;
        }

        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            imageUrl: imageUrl || null,
            audioUrl: audioUrl || null,
            roomId,
            senderId: userId,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        // Broadcast message to everyone in the room
        io.to(roomId).emit('receive_message', message);

        // Also broadcast room update event so chats list moves to top and updates preview
        io.emit('room_updated', {
          roomId,
          lastMessage: message,
        });

        // Send FCM Push notification to all other members (wakes up mobile phones with sound even if closed)
        prisma.roomMember.findMany({
          where: {
            roomId,
            userId: { not: userId },
          },
          include: {
            room: true,
          },
        }).then((members) => {
          if (members.length > 0) {
            const roomObj = members[0].room;
            const pushTitle = roomObj.isGroup ? `${message.sender.username} (#${roomObj.name})` : message.sender.username;
            const pushBody = message.content || (message.imageUrl ? '📷 Изображение' : message.audioUrl ? '🎤 Голосовое сообщение' : 'Новое сообщение');

            sendPushToUsers(
              members.map((m) => m.userId),
              {
                title: pushTitle,
                body: pushBody,
                roomId,
                avatar: message.sender.avatar,
              }
            ).catch((err) => console.error('FCM dispatch error:', err));
          }
        }).catch((err) => console.error('Error fetching room members for FCM:', err));
      } catch (error) {
        console.error('Error handling send_message:', error);
        socket.emit('error', { message: 'Ошибка при отправке сообщения' });
      }
    });

    // Handle edit message
    socket.on('edit_message', async (data: { messageId: string; roomId: string; newContent: string }) => {
      try {
        const { messageId, roomId, newContent } = data;
        if (!newContent || !newContent.trim()) return;

        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!message || message.senderId !== userId) {
          socket.emit('error', { message: 'Нет прав на редактирование' });
          return;
        }

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: {
            content: newContent.trim(),
            isEdited: true,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        io.to(roomId).emit('message_edited', updated);
        io.emit('room_updated', { roomId, lastMessage: updated });
      } catch (error) {
        console.error('Error editing message:', error);
      }
    });

    // Handle delete message
    socket.on('delete_message', async (data: { messageId: string; roomId: string }) => {
      try {
        const { messageId, roomId } = data;

        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!message || message.senderId !== userId) {
          socket.emit('error', { message: 'Нет прав на удаление' });
          return;
        }

        await prisma.message.delete({
          where: { id: messageId },
        });

        io.to(roomId).emit('message_deleted', { messageId, roomId });
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    });

    // Typing status
    socket.on('typing_start', (roomId: string) => {
      socket.to(roomId).emit('user_typing', {
        roomId,
        userId,
        username,
      });
    });

    socket.on('typing_stop', (roomId: string) => {
      socket.to(roomId).emit('user_stop_typing', {
        roomId,
        userId,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          // Mark offline in DB and broadcast
          await prisma.user.update({
            where: { id: userId },
            data: { status: 'offline' },
          }).catch(() => {});

          io.emit('user_status_changed', { userId, status: 'offline' });
        }
      }
    });
  });
};
