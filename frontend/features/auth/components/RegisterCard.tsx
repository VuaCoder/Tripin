'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { RegisterForm } from './RegisterForm';
import { RegisterResultData } from '../types';

interface RegisterCardProps {
  onSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
}

export const RegisterCard: React.FC<RegisterCardProps> = ({ onSuccess, onError }) => {
  const router = useRouter();

  return (
    <div className="w-full max-w-[420px] rounded-[38px] px-7 sm:px-9 py-6 sm:py-8 flex flex-col items-center border shadow-2xl relative bg-white border-white animate-fadeIn" data-purpose="auth-container">
      {/* Subtle top mobile speaker notch indicator */}
      <div className="w-16 h-1 bg-slate-200 rounded-full mb-4" />

      {/* Tripri Header Logo */}
      <div className="flex flex-col items-center mb-4 text-center">
        <img
          src="/images/tripri-logo.png"
          alt="Tripri Logo"
          className="h-14 w-auto object-contain drop-shadow-md mb-2"
        />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Đăng ký</h2>
      </div>

      {/* Quick Auth Mode Switcher with Sliding Pill Effect */}
      <div className="w-full bg-slate-100/80 p-1.5 rounded-2xl flex items-center mb-4 border border-slate-200/60 relative" data-purpose="auth-mode-switcher">
        <div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-md transition-all duration-300 ease-out left-[calc(50%+1.5px)]"
        />
        <button
          type="button"
          onClick={() => router.push('/login', { scroll: false })}
          className="relative z-10 flex-1 py-2 text-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors duration-200 cursor-pointer"
        >
          Đăng nhập
        </button>
        <button
          type="button"
          className="relative z-10 flex-1 py-2 text-center text-sm font-bold text-brand-teal transition-colors duration-200 cursor-default"
        >
          Đăng ký
        </button>
      </div>

      {/* Form authentication */}
      <RegisterForm
        onSuccess={onSuccess}
        onError={onError}
        onSwitchToLogin={() => router.push('/login', { scroll: false })}
      />
    </div>
  );
};
