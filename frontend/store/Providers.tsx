'use client';

import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { AuthBootstrap } from '@/features/auth/components/AuthBootstrap';
import { store } from './index';
import { useEffect } from 'react';
import { setupListeners } from '@reduxjs/toolkit/query';
import { ChatProvider } from '@/features/chat/ChatProvider';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => setupListeners(store.dispatch), []);
  return (
    <Provider store={store}>
      <AuthBootstrap />
      <ChatProvider>{children}</ChatProvider>
    </Provider>
  );
}
