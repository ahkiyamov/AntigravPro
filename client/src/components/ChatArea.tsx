import React, { useState, useEffect, useRef } from 'react';
import { Room, Message, TypingEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  Send,
  Smile,
  Hash,
  Users,
  Loader2,
  User as UserIcon,
  MessageCircle,
  Image as ImageIcon,
  X,
  Edit2,
  Trash2,
  Check,
  Mic,
  Square,
  ArrowLeft,
} from 'lucide-react';

interface ChatAreaProps {
  room: Room | null;
  onMessageSent?: () => void;
  onBack?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ room, onMessageSent, onBack }) => {
  const { user } = useAuth();
  const { socket, onlineUserIds } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  // Play pleasant notification sound
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio autoplay policy ignored
    }
  };

  // Load message history on room change
  useEffect(() => {
    if (!room) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/chat/rooms/${room.id}/messages`);
        setMessages(res.data.messages);
        setTimeout(() => scrollToBottom('auto'), 100);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    setTypingUsers(new Map());
    setEditingMessageId(null);
    setImagePreview(null);
    cancelRecording();

    // Join room on socket
    if (socket) {
      socket.emit('join_room', room.id);
    }

    return () => {
      if (socket) {
        socket.emit('leave_room', room.id);
      }
    };
  }, [room?.id, socket]);

  // Listen for socket events
  useEffect(() => {
    if (!socket || !room) return;

    const handleReceiveMessage = (newMessage: Message) => {
      if (newMessage.roomId === room.id) {
        setMessages((prev) => [...prev, newMessage]);
        setTimeout(() => scrollToBottom('smooth'), 50);

        if (newMessage.senderId !== user?.id) {
          playNotificationSound();
        }
      }
    };

    const handleMessageEdited = (editedMessage: Message) => {
      if (editedMessage.roomId === room.id) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === editedMessage.id ? editedMessage : msg))
        );
      }
    };

    const handleMessageDeleted = ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      if (roomId === room.id) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      }
    };

    const handleUserTyping = (data: TypingEvent) => {
      if (data.roomId === room.id && data.userId !== user?.id) {
        setTypingUsers((prev) => {
          const map = new Map(prev);
          map.set(data.userId, data.username);
          return map;
        });
      }
    };

    const handleUserStopTyping = (data: { roomId: string; userId: string }) => {
      if (data.roomId === room.id) {
        setTypingUsers((prev) => {
          const map = new Map(prev);
          map.delete(data.userId);
          return map;
        });
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [socket, room?.id, user?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!socket || !room) return;

    socket.emit('typing_start', room.id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', room.id);
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !imagePreview) || !socket || !room) return;

    socket.emit('send_message', {
      roomId: room.id,
      content: inputText.trim(),
      imageUrl: imagePreview || undefined,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing_stop', room.id);

    setInputText('');
    setImagePreview(null);
    setShowEmojiPicker(false);
    if (onMessageSent) onMessageSent();
  };

  // Image upload handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Voice recording methods
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Пожалуйста, разрешите доступ к микрофону в браузере для записи голосовых сообщений.');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        const base64Audio = reader.result as string;
        if (socket && room) {
          socket.emit('send_message', {
            roomId: room.id,
            content: '🎤 Голосовое сообщение',
            audioUrl: base64Audio,
          });
          if (onMessageSent) onMessageSent();
        }
      };
      reader.readAsDataURL(audioBlob);

      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  // Edit message
  const startEditing = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content);
  };

  const saveEdit = (messageId: string) => {
    if (!editText.trim() || !socket || !room) return;

    socket.emit('edit_message', {
      messageId,
      roomId: room.id,
      newContent: editText.trim(),
    });

    setEditingMessageId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  // Delete message
  const handleDeleteMessage = (messageId: string) => {
    if (!socket || !room) return;
    if (confirm('Удалить это сообщение?')) {
      socket.emit('delete_message', {
        messageId,
        roomId: room.id,
      });
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  if (!room) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-8 select-none">
        <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center shadow-inner mb-4 border border-slate-700">
          <MessageCircle className="w-10 h-10 text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Выберите чат</h3>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Выберите диалог из списка слева или создайте новый, чтобы начать общение в реальном времени.
        </p>
      </div>
    );
  }

  const isUserOnline =
    !room.isGroup && room.otherUserId
      ? onlineUserIds.has(room.otherUserId)
      : false;

  const typingNames = Array.from(typingUsers.values());

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-900 overflow-hidden relative">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/95 backdrop-blur flex items-center justify-between z-20 shrink-0 sticky top-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Назад к списку чатов"
              className="md:hidden p-2 -ml-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            {room.isGroup ? (
              <div className="w-10 h-10 rounded-xl bg-purple-900/40 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                <Hash className="w-5 h-5" />
              </div>
            ) : room.avatar ? (
              <img
                src={room.avatar}
                alt={room.name}
                className="w-10 h-10 rounded-full bg-slate-700 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-slate-400" />
              </div>
            )}

            {!room.isGroup && (
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isUserOnline ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
            )}
          </div>

          <div>
            <h2 className="font-bold text-white text-base leading-tight">
              {room.name}
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              {room.isGroup ? (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span>{room.membersCount} участников</span>
                </>
              ) : (
                <span className={isUserOnline ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                  {isUserOnline ? 'В сети' : 'Не в сети'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
            <p>Здесь пока нет сообщений.</p>
            <p className="text-xs text-slate-600 mt-1">Отправьте первое сообщение ниже!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender.id === user?.id;
            const isEditing = editingMessageId === msg.id;
            const showSenderHeader =
              !isMe &&
              (index === 0 || messages[index - 1].sender.id !== msg.sender.id);

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] sm:max-w-[70%] group ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {!isMe && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 overflow-hidden self-end mb-1">
                    {msg.sender.avatar ? (
                      <img
                        src={msg.sender.avatar}
                        alt={msg.sender.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">
                        {msg.sender.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1 relative">
                  {showSenderHeader && room.isGroup && (
                    <span className="text-[11px] font-semibold text-indigo-400 ml-1">
                      {msg.sender.username}
                    </span>
                  )}

                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words relative leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                    }`}
                  >
                    {/* Attached Image */}
                    {msg.imageUrl && (
                      <div className="mb-2 max-w-sm rounded-xl overflow-hidden border border-black/20">
                        <img
                          src={msg.imageUrl}
                          alt="Вложение"
                          className="max-h-72 w-auto object-cover rounded-lg cursor-pointer hover:opacity-95 transition"
                          onClick={() => window.open(msg.imageUrl!, '_blank')}
                        />
                      </div>
                    )}

                    {/* Voice Audio Message */}
                    {msg.audioUrl && (
                      <div className="my-1 p-1 bg-slate-900/50 rounded-xl border border-slate-700/50 flex items-center">
                        <audio
                          controls
                          src={msg.audioUrl}
                          className="h-8 max-w-[230px] sm:max-w-[270px] rounded"
                        />
                      </div>
                    )}

                    {/* Content or Edit Input */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(msg.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <button
                          onClick={() => saveEdit(msg.id)}
                          className="p-1 text-emerald-300 hover:text-emerald-100"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-red-300 hover:text-red-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span>{msg.content}</span>
                    )}

                    <div
                      className={`text-[10px] mt-1 text-right select-none flex items-center justify-end gap-1.5 ${
                        isMe ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.isEdited && <span className="italic opacity-80">(изменено)</span>}
                      <span>{formatMessageTime(msg.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions for own message on hover */}
                  {isMe && !isEditing && (
                    <div className="absolute top-1 -left-16 hidden group-hover:flex items-center gap-1 bg-slate-800/95 border border-slate-700 rounded-lg p-1 shadow-lg z-20">
                      <button
                        onClick={() => startEditing(msg)}
                        title="Редактировать"
                        className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Удалить"
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator bubble */}
        {typingNames.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1 animate-pulse">
            <div className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {typingNames.join(', ')} {typingNames.length > 1 ? 'печатают...' : 'печатает...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        {/* Image Attachment Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-xl border border-indigo-500 shadow-lg"
            />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-slate-800 border border-slate-700 rounded-xl flex gap-3 text-xl w-fit shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {['👋', '👍', '❤️', '🔥', '😂', '🎉', '🚀', '✨'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {isRecording ? (
          /* Voice recording active bar */
          <div className="flex items-center justify-between gap-3 bg-slate-800/90 border border-red-500/40 rounded-2xl p-2.5 px-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
              <span className="text-sm font-semibold text-red-400">
                Запись: {formatTimer(recordingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                title="Отменить запись"
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-xl transition"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                title="Отправить голосовое"
                className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-lg shadow-red-600/30 transition flex items-center gap-1.5 text-xs font-semibold"
              >
                <Square className="w-4 h-4 fill-white" />
                Отправить
              </button>
            </div>
          </div>
        ) : (
          /* Normal message input form */
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить изображение"
              className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Эмодзи"
              className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={`Сообщение в ${room.name}...`}
              className="flex-1 py-3 px-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />

            {inputText.trim() || imagePreview ? (
              <button
                type="submit"
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition duration-200"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                title="Записать голосовое сообщение"
                className="p-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition duration-200"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
