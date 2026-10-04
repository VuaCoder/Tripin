'use client';

import React from 'react';
import Link from 'next/link';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { RegisterResultData } from '../types';

interface RegisterFormProps {
  onSuccess?: (data: RegisterResultData) => void;
  onError?: (errorMessage: string) => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onError, onSwitchToLogin }) => {
  const {
    formData,
    showPassword,
    showConfirmPassword,
    errors,
    isLoading,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    handleInputChange,
    handleSubmit,
    handleGoogleRegister,
  } = useRegisterForm({ onSuccess, onError });

  return (
    <form className="w-full flex flex-col space-y-3.5 animate-fadeInScale" onSubmit={handleSubmit} data-purpose="register-form">
      {/* General Error Alert - Floating Top-Right Toast */}
      {errors.general && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] sm:w-96 p-4 bg-white/95 backdrop-blur-xl border-l-4 border-red-500 rounded-2xl shadow-2xl flex items-start gap-3 text-slate-800 border border-slate-100/80 animate-slide-in-right">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-vietnam text-xs font-bold text-red-600 uppercase tracking-wide">Thông báo lỗi</p>
            <p className="font-vietnam text-xs text-slate-700 font-medium mt-0.5 leading-relaxed">{errors.general}</p>
          </div>
        </div>
      )}

      {/* Full Name Input (Separate Label with Red Asterisk) */}
      <div>
        <label htmlFor="user-fullName" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
          Họ và tên <span className="text-red-500 font-bold">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <input
            id="user-fullName"
            name="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Nhập họ và tên"
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
              errors.fullName
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
            }`}
          />
        </div>
        {errors.fullName && (
          <p className="mt-1 text-xs text-red-600 pl-1">{errors.fullName}</p>
        )}
      </div>

      {/* Email Input (Separate Label with Red Asterisk) */}
      <div>
        <label htmlFor="user-email" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
          Địa chỉ email <span className="text-red-500 font-bold">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <input
            id="user-email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Nhập địa chỉ email"
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
              errors.email
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
            }`}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-xs text-red-600 pl-1">{errors.email}</p>
        )}
      </div>

      {/* Phone Number Input (Separate Label with Red Asterisk) */}
      <div>
        <label htmlFor="user-phone" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
          Số điện thoại <span className="text-red-500 font-bold">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <input
            id="user-phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Nhập số điện thoại"
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
              errors.phone
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
            }`}
          />
        </div>
        {errors.phone && (
          <p className="mt-1 text-xs text-red-600 pl-1">{errors.phone}</p>
        )}
      </div>

      {/* Password Input with Toggle (Separate Label with Red Asterisk) */}
      <div>
        <label htmlFor="user-password" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
          Mật khẩu <span className="text-red-500 font-bold">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            id="user-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            value={formData.password}
            onChange={handleInputChange}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            placeholder="Nhập mật khẩu"
            className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
              errors.password
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
            }`}
          />
          <button
            id="togglePassword"
            type="button"
            aria-label="Hiện hoặc ẩn mật khẩu"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-red-600 pl-1">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password Input with Toggle (Separate Label with Red Asterisk) */}
      <div>
        <label htmlFor="user-confirmPassword" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
          Xác nhận mật khẩu <span className="text-red-500 font-bold">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            id="user-confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            value={formData.confirmPassword}
            onChange={handleInputChange}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            placeholder="Nhập lại mật khẩu"
            className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
              errors.confirmPassword
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
            }`}
          />
          <button
            id="toggleConfirmPassword"
            type="button"
            aria-label="Hiện hoặc ẩn mật khẩu xác nhận"
            onClick={toggleConfirmPasswordVisibility}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showConfirmPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-red-600 pl-1">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Primary Action Button: 'Đăng ký ngay' */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3 px-6 rounded-full bg-brand-teal hover:bg-brand-tealLight disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Đang xử lý đăng ký...</span>
          </>
        ) : (
          <span>Đăng ký ngay</span>
        )}
      </button>

      {/* Secondary Action Button: 'Đăng ký bằng Google' */}
      <button
        type="button"
        onClick={handleGoogleRegister}
        className="w-full py-2.5 px-6 rounded-full bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-300 shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
        </svg>
        <span>Đăng ký bằng Google</span>
      </button>

      {/* Link to Login page */}
      <div className="mt-3 flex flex-col items-center text-xs">
        <div className="text-slate-500 pt-1">
          Đã có tài khoản?{' '}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-brand-tealLight hover:text-brand-teal font-semibold transition-colors underline decoration-dotted"
            >
              Đăng nhập ngay
            </button>
          ) : (
            <Link
              href="/login"
              className="text-brand-tealLight hover:text-brand-teal font-semibold transition-colors underline decoration-dotted"
            >
              Đăng nhập ngay
            </Link>
          )}
        </div>
      </div>
    </form>
  );
};
