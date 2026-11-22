import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
import { api } from './services/api';
import { Room } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { AuthModal } from './components/AuthModal';
import { NewDirectModal } from './components/NewDirectModal';
import { NewGroupModal } from './components/NewGroupModal';
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
} from './utils/notifications';
import { initPushNotifications } from './services/pushService';
import { Loader2, Bell, X } from 'lucide-react';

interface ToastData {
  id: string;
  roomId: string;
  title: string;
  message: string;
  avatar?: string | null;
}

export const MainChatApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { socket } = useSocket();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Notifications state
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastData | null>(null);

  // Check initial notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsGranted(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleNotifications = async () => {
    const perm = await requestNotificationPermission();
    const granted = perm === 'granted';
    setNotificationsGranted(granted);
    if (granted) {
      playNotificationSound();
      showBrowserNotification('Уведомления включены! 🎉', {
        body: 'Теперь вы будете получать системные оповещения о новых сообщениях.',
      });
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setIsMobileChatOpen(true);
    // Clear unread for this room
    setUnreadCounts((prev) => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });
  };

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data.rooms);

      // Auto select first room if none selected
      if (!activeRoomId && res.data.rooms.length > 0) {
        setActiveRoomId(res.data.rooms[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (user) {
      fetchRooms();
      initPushNotifications((roomId) => handleSelectRoom(roomId));
    }
  }, [user, fetchRooms]);

  // Update browser tab title based on unread count
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `🔔 (${totalUnread}) Antigrav Chat`;
    } else {
      document.title = 'Antigrav Chat - Realtime Messenger';
    }
  }, [totalUnread]);

  // Auto dismiss in-app toast after 4 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Listen for socket room updates and incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdated = ({ roomId, lastMessage }: { roomId: string; lastMessage: any }) => {
      // 1. Update rooms order in state
      setRooms((prevRooms) => {
        const roomIndex = prevRooms.findIndex((r) => r.id === roomId);
        if (roomIndex === -1) {
          fetchRooms();
          return prevRooms;
        }

        const updatedRoom = {
          ...prevRooms[roomIndex],
          lastMessage,
          updatedAt: lastMessage.createdAt,
        };

        const otherRooms = prevRooms.filter((r) => r.id !== roomId);
        return [updatedRoom, ...otherRooms];
      });

      // 2. Notify user if message is from another user
      const senderId = lastMessage?.senderId || lastMessage?.sender?.id;
      if (senderId && senderId !== user?.id) {
        // Sound notification
        playNotificationSound();

        // Check if user is currently looking at this chat
        const isCurrentlyViewing = activeRoomId === roomId && !document.hidden;

        if (!isCurrentlyViewing) {
          // Increase unread count
          setUnreadCounts((prev) => ({
            ...prev,
            [roomId]: (prev[roomId] || 0) + 1,
          }));

          const targetRoom = rooms.find((r) => r.id === roomId);
          const senderName = lastMessage?.sender?.username || 'Пользователь';
          const notifTitle = targetRoom?.isGroup
            ? `${senderName} (#${targetRoom.name})`
            : senderName;
          const notifBody =
            lastMessage?.content ||
            (lastMessage?.imageUrl ? '📷 Фотография' : lastMessage?.audioUrl ? '🎤 Голосовое сообщение' : 'Новое сообщение');

          // Native OS / Browser notification
          showBrowserNotification(notifTitle, {
            body: notifBody,
            icon: lastMessage?.sender?.avatar,
            onClick: () => {
              handleSelectRoom(roomId);
            },
          });

          // In-app Toast banner
          setActiveToast({
            id: String(Date.now()),
            roomId,
            title: notifTitle,
            message: notifBody,
            avatar: lastMessage?.sender?.avatar,
          });
        }
      }
    };

    socket.on('room_updated', handleRoomUpdated);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
    };
  }, [socket, fetchRooms, user?.id, activeRoomId, rooms]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <span className="text-sm font-medium text-slate-400">Загрузка приложения...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-screen overflow-hidden bg-slate-900 font-sans">
      {/* In-app Toast Banner */}
      {activeToast && (
        <div
          onClick={() => {
            handleSelectRoom(activeToast.roomId);
            setActiveToast(null);
          }}
          className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-slate-800/95 border border-indigo-500/50 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer backdrop-blur-md animate-in slide-in-from-top-3 hover:bg-slate-700/80 transition"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {activeToast.avatar ? (
              <img
                src={activeToast.avatar}
                alt=""
                className="w-10 h-10 rounded-full bg-slate-700 shrink-0 object-cover border border-indigo-500/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold">
                <Bell className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <span>{activeToast.title}</span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">{activeToast.message}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToast(null);
            }}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Left Sidebar */}
      <div className={`h-full ${isMobileChatOpen ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          unreadCounts={unreadCounts}
          notificationsGranted={notificationsGranted}
          onToggleNotifications={handleToggleNotifications}
          onSelectRoom={handleSelectRoom}
          onOpenNewDirect={() => setIsDirectModalOpen(true)}
          onOpenNewGroup={() => setIsGroupModalOpen(true)}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`h-full flex-1 ${isMobileChatOpen ? 'flex w-full' : 'hidden md:flex'}`}>
        <ChatArea
          room={activeRoom}
          onMessageSent={fetchRooms}
          onBack={() => setIsMobileChatOpen(false)}
        />
      </div>

      {/* Modals */}
      <NewDirectModal
        isOpen={isDirectModalOpen}
        onClose={() => setIsDirectModalOpen(false)}
        onSelectRoom={(roomId) => {
          fetchRooms();
          handleSelectRoom(roomId);
        }}
      />

      <NewGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onRoomCreated={(roomId) => {
          fetchRooms();
          handleSelectRoom(roomId);
        }}
      />
    </div>
  );
};

export default MainChatApp;
