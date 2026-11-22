import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { X, Users, Loader2, Check } from 'lucide-react';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const [name, setName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.get('/users');
        setUsers(res.data.users);
      } catch (err) {
        console.error('Failed to load users for group', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название группы');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/chat/rooms/group', {
        name: name.trim(),
        participantIds: selectedIds,
      });

      onRoomCreated(res.data.roomId);
      setName('');
      setSelectedIds([]);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка создания группы');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Создать канал / группу</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Название группы / канала
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="например: Проект Альфа, Флудилка"
              required
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Добавить участников ({selectedIds.length} выбрано)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  Нет доступных пользователей для добавления
                </div>
              ) : (
                users.map((u) => {
                  const isSelected = selectedIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelect(u.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition border ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500/50 text-white'
                          : 'bg-slate-900/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar || ''}
                          alt={u.username}
                          className="w-8 h-8 rounded-full bg-slate-700"
                        />
                        <span className="text-sm font-medium">{u.username}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Создать канал'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
