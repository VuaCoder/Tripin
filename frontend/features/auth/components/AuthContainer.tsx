'use client';

import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LoginResultData, RegisterResultData } from '../types';

interface AuthContainerProps {
  initialMode: 'login' | 'register';
  onLoginSuccess?: (data: LoginResultData) => void;
  onRegisterSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialMode,
  onLoginSuccess,
  onRegisterSuccess,
  onError,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  
  const pillRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Synchronize mode if props change
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSwitchMode = (targetMode: 'login' | 'register') => {
    if (mode === targetMode) return;
    setMode(targetMode);
    
    // Pure SPA URL pushState without full page reload
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', targetMode === 'login' ? '/login' : '/register');
    }
  };

  // GSAP animation on tab switch & mode change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Animate tab sliding pill indicator perfectly within boundaries
    if (pillRef.current) {
      gsap.to(pillRef.current, {
        xPercent: mode === 'login' ? 0 : 100,
        duration: 0.3,
        ease: 'power2.out',
      });
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
            alt="Tripri Logo"
            className="h-10 w-auto object-contain brightness-0 invert drop-shadow-md"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvgyrWOQJ_Pboo1MmnwXZli0jTh-C8sZAQbCs8MzFn_vgUnw_kluvF-Hql74XSvzuRjZEUidQy4HIox8FchlHXBop2MvKSBXZIU_1G19ykGDeRDpvNF7qGOz0jtqNON33xfk2l9fOVcZM9BLqI3mxg4oze3578r5T_EnK3J22_Y6yg1lJRT95VKZNmiEL7LBDdbV8Sfn0Dcg9UNzZb4nyso89EM-ouGte5ojp4HDZdeAwZviAMHlLqoB32buuHttnr4imYhkjQe8aHLDU"
          />
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center bg-white relative">
        {/* Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {mode === 'login' ? 'CHÀO MỪNG QUAY LẠI !' : 'XIN CHÀO !'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login'
                ? 'Vui lòng nhập thông tin đăng nhập của bạn.'
                : 'Điền đầy đủ các thông tin bắt buộc dưới đây.'}
            </p>
          </div>

          {/* GSAP Animated Tab Switcher */}
          <div className="bg-slate-200/70 p-1 rounded-2xl flex items-center w-full sm:w-56 relative overflow-hidden border border-slate-200/80 self-start sm:self-auto">
            {/* GSAP Sliding Pill Indicator */}
            <div
              ref={pillRef}
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm pointer-events-none z-0"
            />

            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`relative z-10 flex-1 py-1.5 text-center text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer ${
                mode === 'login' ? 'text-brand-teal' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`relative z-10 flex-1 py-1.5 text-center text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer ${
                mode === 'register' ? 'text-brand-teal' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đăng ký
            </button>
          </div>
        </div>

        {/* GSAP Animated Form Wrapper */}
        <div ref={formRef} className="w-full">
          {mode === 'login' ? (
            <LoginForm
              onSuccess={onLoginSuccess}
              onError={onError}
              onSwitchToRegister={() => handleSwitchMode('register')}
            />
          ) : (
            <RegisterForm
              onSuccess={onRegisterSuccess}
              onError={onError}
              onSwitchToLogin={() => handleSwitchMode('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
