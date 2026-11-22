import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { useSocket } from '../context/SocketContext';
import { X, Search, User as UserIcon, Loader2, MessageSquarePlus } from 'lucide-react';

interface NewDirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
}

export const NewDirectModal: React.FC<NewDirectModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
}) => {
  const { onlineUserIds } = useSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.get('/users', {
          params: { search: search || undefined },
        });
        setUsers(res.data.users);
      } catch (err) {
        console.error('Failed to load users', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [isOpen, search]);

  if (!isOpen) return null;

  const handleStartChat = async (targetUserId: string) => {
    try {
      setSubmittingId(targetUserId);
      const res = await api.post('/chat/rooms/direct', { targetUserId });
      onSelectRoom(res.data.roomId);
      onClose();
    } catch (err) {
      console.error('Failed to start direct chat', err);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Новый диалог</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-4 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени пользователя..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Users list */}
        <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Пользователи не найдены
            </div>
          ) : (
            users.map((u) => {
              const isOnline = onlineUserIds.has(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => handleStartChat(u.id)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 hover:bg-slate-700/60 border border-transparent hover:border-slate-600 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.username}
                          className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                          <UserIcon className="w-5 h-5" />
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-white group-hover:text-indigo-300 transition text-sm">
                        {u.username}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isOnline ? 'В сети' : 'Не в сети'}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={submittingId === u.id}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white rounded-lg transition"
                  >
                    {submittingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Написать'
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
