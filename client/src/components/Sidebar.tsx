import React, { useState } from 'react';
import { Room } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  MessageSquare,
  Users,
  Hash,
  LogOut,
  Plus,
  Search,
  User as UserIcon,
  Bell,
  BellOff,
} from 'lucide-react';

interface SidebarProps {
  rooms: Room[];
  activeRoomId: string | null;
  unreadCounts?: Record<string, number>;
  notificationsGranted?: boolean;
  onToggleNotifications?: () => void;
  onSelectRoom: (roomId: string) => void;
  onOpenNewDirect: () => void;
  onOpenNewGroup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  activeRoomId,
  unreadCounts = {},
  notificationsGranted = false,
  onToggleNotifications,
  onSelectRoom,
  onOpenNewDirect,
  onOpenNewGroup,
}) => {
  const { user, logout } = useAuth();
  const { onlineUserIds } = useSocket();
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [search, setSearch] = useState('');

  const filteredRooms = rooms.filter((room) => {
    if (filter === 'direct' && room.isGroup) return false;
    if (filter === 'group' && !room.isGroup) return false;
    if (search.trim()) {
      return room.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-96 h-full bg-slate-800 md:border-r border-slate-700/80 flex flex-col select-none shrink-0">
      {/* Header / User Info */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-10 h-10 rounded-full bg-slate-700 object-cover border border-indigo-500/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-800" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{user?.username}</span>
            </div>
            <div className="text-xs text-emerald-400 font-medium">в сети</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onToggleNotifications && (
            <button
              onClick={onToggleNotifications}
              title={notificationsGranted ? 'Уведомления включены' : 'Включить системные уведомления'}
              className={`p-2 rounded-xl transition ${
                notificationsGranted
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {notificationsGranted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={logout}
            title="Выйти из аккаунта"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 grid grid-cols-2 gap-2 border-b border-slate-700/50">
        <button
          onClick={onOpenNewDirect}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Диалог
        </button>
        <button
          onClick={onOpenNewGroup}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold transition"
        >
          <Users className="w-3.5 h-3.5" />
          Канал
        </button>
      </div>

      {/* Search & Filter Tabs */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex bg-slate-900/60 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Все ({rooms.length})
          </button>
          <button
            onClick={() => setFilter('direct')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              filter === 'direct'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Личные
          </button>
          <button
            onClick={() => setFilter('group')}
            className={`flex-1 py-1 rounded-lg font-medium transition ${
              filter === 'group'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Каналы
          </button>
        </div>
      </div>

      {/* Rooms list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500 text-xs">
            Чаты не найдены. Начните диалог или создайте канал!
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const isUserOnline =
              !room.isGroup && room.otherUserId
                ? onlineUserIds.has(room.otherUserId)
                : false;

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {/* Avatar / Icon */}
                <div className="relative shrink-0">
                  {room.isGroup ? (
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
                        isActive
                          ? 'bg-indigo-700 text-white'
                          : 'bg-purple-900/40 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      <Hash className="w-5 h-5" />
                    </div>
                  ) : room.avatar ? (
                    <img
                      src={room.avatar}
                      alt={room.name}
                      className="w-11 h-11 rounded-full bg-slate-700 object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}

                  {!room.isGroup && (
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                        isActive ? 'border-indigo-600' : 'border-slate-800'
                      } ${isUserOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isActive ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {room.name}
                    </span>
                    {room.lastMessage && (
                      <span
                        className={`text-[10px] shrink-0 ml-1 ${
                          isActive ? 'text-indigo-200' : 'text-slate-500'
                        }`}
                      >
                        {formatTime(room.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <p
                      className={`text-xs truncate flex-1 ${
                        isActive ? 'text-indigo-100' : 'text-slate-400'
                      }`}
                    >
                      {room.lastMessage ? (
                        <>
                          <span className="font-medium">
                            {room.lastMessage.sender.username === user?.username
                              ? 'Вы: '
                              : room.isGroup
                              ? `${room.lastMessage.sender.username}: `
                              : ''}
                          </span>
                          {room.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic opacity-60">Нет сообщений</span>
                      )}
                    </p>

                    {(unreadCounts[room.id] || 0) > 0 && !isActive && (
                      <span className="min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-bold rounded-full bg-indigo-500 text-white shrink-0 shadow-sm animate-pulse">
                        {unreadCounts[room.id]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
