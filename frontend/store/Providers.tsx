'use client';

import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { AuthBootstrap } from '@/features/auth/components/AuthBootstrap';
import { store } from './index';
import { useEffect } from 'react';
import { setupListeners } from '@reduxjs/toolkit/query';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => setupListeners(store.dispatch), []);
  return (
    <Provider store={store}>
      <AuthBootstrap />
      {children}
    </Provider>
  );
}
