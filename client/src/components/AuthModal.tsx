import React, { useState } from 'react';
import { api, getBaseServerUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock, Mail, User as UserIcon, Loader2, Settings } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getBaseServerUrl());
  const [savedServerMsg, setSavedServerMsg] = useState(false);

  const handleSaveServerUrl = () => {
    let url = serverUrlInput.trim().replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    localStorage.setItem('server_url', url);
    setServerUrlInput(url);
    setSavedServerMsg(true);
    setTimeout(() => setSavedServerMsg(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.post('/auth/register', {
          username,
          email,
          password,
        });
        login(res.data.user, res.data.token);
      } else {
        const res = await api.post('/auth/login', {
          login: username || email,
          password,
        });
        login(res.data.user, res.data.token);
      }
    } catch (err: any) {
      const details =
        err.response?.data?.message ||
        err.message ||
        'Произошла ошибка при авторизации.';
      setError(`${details} (Сервер: ${getBaseServerUrl()})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister
              ? 'Зарегистрируйтесь для общения в чате'
              : 'Войдите в свой профиль для доступа к беседам'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {isRegister ? 'Имя пользователя (Никнейм)' : 'Логин или Email'}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isRegister ? 'Например: alex_dev' : 'Логин или email'}
                required
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRegister ? (
              'Зарегистрироваться'
            ) : (
              'Войти'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {isRegister ? (
            <>
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                Войти
              </button>
            </>
          ) : (
            <>
              Еще нет аккаунта?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                Создать аккаунт
              </button>
            </>
          )}
        </div>

        {/* Server Config for Mobile / Debug */}
        <div className="mt-5 pt-3 border-t border-slate-700/60 text-center">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="text-xs text-slate-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 mx-auto transition"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Настройки сервера ({getBaseServerUrl()})</span>
          </button>
          {showServerConfig && (
            <div className="mt-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700 text-left">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Адрес сервера API:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://192.168.1.38:5000"
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
                >
                  {savedServerMsg ? 'Сохранено!' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
