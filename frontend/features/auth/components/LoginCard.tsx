'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { LoginResultData } from '../types';

interface LoginCardProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onSuccess, onError }) => {
  const router = useRouter();

  return (
    <div className="w-full max-w-[420px] rounded-[38px] px-7 sm:px-9 py-7 sm:py-9 flex flex-col items-center border shadow-2xl relative bg-white border-white animate-fadeIn" data-purpose="auth-container">
      {/* Subtle top mobile speaker notch indicator */}
      <div className="w-16 h-1 bg-slate-200 rounded-full mb-4" />

      {/* Tripri Header Logo */}
      <div className="flex flex-col items-center mb-4 text-center">
        <img
          src="/images/tripri-logo.png"
          alt="Tripri Logo"
          className="h-14 w-auto object-contain drop-shadow-md mb-2"
        />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Đăng nhập</h2>
      </div>

      {/* Form authentication */}
      <LoginForm
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
};
