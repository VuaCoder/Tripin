'use client';

import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { AuthBootstrap } from '@/features/auth/components/AuthBootstrap';
import { store } from './index';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <AuthBootstrap />
      {children}
    </Provider>
  );
}
