'use client';

import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LoginResultData, RegisterableRole, RegisterResultData } from '../types';

interface AuthContainerProps {
  initialMode: 'login' | 'register';
  /** Role sent to the backend when the register form is submitted. */
  registerRole?: RegisterableRole;
  onLoginSuccess?: (data: LoginResultData) => void;
  onRegisterSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialMode,
  registerRole = 'TRAVELER',
  onLoginSuccess,
  onRegisterSuccess,
  onError,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const formRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Synchronize mode if props change
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // GSAP animation on mode change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Animate form container fade & subtle scale
    if (formRef.current) {
      gsap.fromTo(
        formRef.current,
        { opacity: 0, y: 10, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  }, [mode]);

  return (
    <div
      className="w-full max-w-5xl bg-white rounded-[32px] border border-slate-100 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px] sm:min-h-[600px] relative z-10 my-auto animate-fadeInScale"
      data-purpose="auth-container"
    >
      {/* Left Column: Scenic Travel Photography Panel */}
      <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-between p-8 overflow-hidden group">
        {/* Scenic Travel Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
          style={{ backgroundImage: `url('/images/auth-hero.png')` }}
        />
        {/* Subtle top gradient overlay for logo contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-transparent to-slate-950/20" />

        {/* Top: Tripri Brand White Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/images/tripri-logo.png"
            alt="Tripri Logo"
            className="h-10 w-auto object-contain brightness-0 invert drop-shadow-md"
          />
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center bg-white relative">
        {/* Header */}
        <div className="mb-6 pb-2 border-b border-slate-100">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login'
              ? 'CHÀO MỪNG QUAY LẠI !'
              : registerRole === 'TOUR_GUIDE'
              ? 'TẠO TÀI KHOẢN HƯỚNG DẪN VIÊN'
              : 'TẠO TÀI KHOẢN TRAVELER'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'Vui lòng nhập thông tin đăng nhập của bạn.'
              : 'Điền đầy đủ các thông tin bắt buộc dưới đây để bắt đầu trải nghiệm.'}
          </p>
        </div>

        {/* Form Wrapper */}
        <div ref={formRef} className="w-full">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={onLoginSuccess}
              onError={onError}
            />
          ) : (
            <RegisterForm
              role={registerRole}
              onSuccess={onRegisterSuccess}
              onError={onError}
            />
          )}
        </div>
      </div>
    </div>
  );
};
