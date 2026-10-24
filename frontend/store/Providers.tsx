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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement) {
        const isNumeric = target.type === 'number' || target.inputMode === 'numeric';
        if (isNumeric && (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-')) {
          e.preventDefault();
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement && (target.type === 'number' || target.inputMode === 'numeric')) {
        const text = e.clipboardData?.getData('text');
        if (text && /[eE+-]/.test(text)) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('paste', handlePaste, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('paste', handlePaste, true);
    };
  }, []);
  return (
    <Provider store={store}>
      <AuthBootstrap />
      <ChatProvider>{children}</ChatProvider>
    </Provider>
  );
}
