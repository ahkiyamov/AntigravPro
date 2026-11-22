export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string | null;
  status?: string;
  createdAt?: string;
}

export interface Message {
  id: string;
  content: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  isEdited?: boolean;
  senderId: string;
  roomId: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    avatar?: string | null;
  };
}

export interface Room {
  id: string;
  name: string;
  isGroup: boolean;
  avatar?: string | null;
  otherUserId?: string | null;
  otherUserStatus?: string | null;
  membersCount: number;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    sender: {
      id: string;
      username: string;
    };
  } | null;
  updatedAt: string;
}

export interface TypingEvent {
  roomId: string;
  userId: string;
  username: string;
}
