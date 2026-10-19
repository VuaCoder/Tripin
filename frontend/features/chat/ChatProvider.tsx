'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, selectAccessToken, setCredentials, clearCredentials } from '@/features/auth/store/authSlice';
import { refreshSession } from '@/store/api/baseApi';
import { chatApi } from './api';
import type { Ack, Message } from './types';

interface ChatContextValue {
  delivered: ReadonlySet<string>;
  connected: boolean; status: string; revision: number;
  subscribe: (listener: (message: Message) => void) => () => void;
  send: (id: string, text: string) => Promise<Message> | null;
  reconnect: () => void;
}
const Context = createContext<ChatContextValue | null>(null);
export const useChat = () => {
  const context = useContext(Context);
  if (!context) throw new Error('ChatProvider is required');
  return context;
};
export function ChatProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const listeners = useRef(new Set<(message: Message) => void>());
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Đang kết nối');
  const [revision, setRevision] = useState(0);
  const [delivered, setDelivered] = useState<Set<string>>(new Set());
  const eligible = !!user && ['TRAVELER', 'TOUR_GUIDE'].includes(user.role) && user.permissions.includes('chat:use');
  useEffect(() => {
    setConnected(false);
    if (!eligible || !token || !user) return;
    let disposed = false;
    let refreshing = false;
    const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').origin, {
      path: '/socket.io', auth: { token }, withCredentials: true,
      reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000, randomizationFactor: 0.5,
    });
    socketRef.current = socket;
    const invalidate = () => dispatch(chatApi.util.invalidateTags(['Conversation']));
    const sync = () => { invalidate(); setRevision(value => value + 1); };
    const refresh = async () => {
      if (refreshing || disposed) return;
      refreshing = true;
      socket.disconnect();
      setStatus('Đang xác thực lại');
      const session = await refreshSession();
      if (disposed) return;
      if (session?.user.id === user.id) dispatch(setCredentials(session));
      else dispatch(clearCredentials());
    };
    socket.on('connect', () => { setConnected(true); setStatus('Đã kết nối'); sync(); });
    socket.on('disconnect', reason => {
      setConnected(false); setStatus('Mất kết nối realtime. Bạn vẫn có thể gửi bằng API.');
      if (reason === 'io server disconnect') void refresh();
    });
    socket.on('connect_error', error => {
      setConnected(false); setStatus('Không thể kết nối realtime. Đang thử lại…');
      if (['TOKEN_INVALID', 'UNAUTHENTICATED'].includes(error.message)) void refresh();
      else if (['FORBIDDEN', 'ACCOUNT_BANNED', 'ACCOUNT_NOT_VERIFIED'].includes(error.message)) { socket.disconnect(); setStatus('Tài khoản không có quyền kết nối.'); }
    });
    socket.on('chat:message', (event: { conversationId: string; message: Message }, acknowledge?: (received: boolean) => void) => {
      if (disposed || !event?.message?.id || event.message.conversationId !== event.conversationId) return;
      listeners.current.forEach(listener => listener(event.message));
      acknowledge?.(true);
      invalidate();
    });
    socket.on('chat:delivered', (event: { messageId: string }) => {
      if (!disposed && typeof event?.messageId === 'string') setDelivered(previous => new Set([...Array.from(previous).slice(-1999), event.messageId]));
    });
    const visible = () => { if (document.visibilityState === 'visible') { sync(); if (!socket.connected && !refreshing) socket.connect(); } };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {
      disposed = true; socket.removeAllListeners(); socket.disconnect(); socketRef.current = null;
      document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', visible);
    };
  }, [dispatch, eligible, token, user?.id]); // Account and token changes dispose all old callbacks.
  useEffect(() => { setDelivered(new Set()); }, [user?.id]);
  return <Context.Provider value={{ delivered, connected, status, revision,
    subscribe: listener => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; },
    reconnect: () => socketRef.current?.connect(),
    send: (conversationId, text) => {
      const socket = socketRef.current;
      if (!socket?.connected) return null;
      return new Promise<Message>((resolve, reject) => {
        socket.timeout(10000).emit('chat:send', { conversationId, text }, (error: Error | null, ack: Ack<Message>) => {
          if (error) reject(new Error('Chưa xác nhận được kết quả gửi'));
          else if (!ack?.ok) reject(Object.assign(new Error(ack?.error?.message || 'Không thể gửi tin'), { code: ack?.error?.code }));
          else resolve(ack.data);
        });
      });
    },
  }}>{children}</Context.Provider>;
}
