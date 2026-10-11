'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { BackButton } from './BackButton';
import { validatePassword, validateConfirmPassword } from '../utils/validation';
import { useResetPasswordMutation } from '../api/authApi';
import { getApiErrorMessage } from '../utils/apiError';

interface ResetPasswordPageProps {
  email?: string;
  code?: string;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ email: initialEmail = '', code: initialCode = '' }) => {
  const router = useRouter();
  const [resetPassword] = useResetPasswordMutation();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const errors: typeof fieldErrors = {};

    if (!code || code.trim().length < 6) {
      errors.code = 'Vui lòng nhập đủ 6 chữ số mã OTP.';
    }

    const passVal = validatePassword(newPassword);
    if (!passVal.isValid) {
      errors.newPassword = passVal.error;
    }

    const confirmVal = validateConfirmPassword(newPassword, confirmPassword);
    if (!confirmVal.isValid) {
      errors.confirmPassword = confirmVal.error;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        email,
        code,
        newPassword,
      }).unwrap();

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Đặt lại mật khẩu mới không thành công. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-vietnam text-body-md text-slate-800 flex flex-col justify-center items-center selection:bg-brand-teal selection:text-white relative bg-desk-travel px-4 py-8">
      <AuthBackground />
      <BackButton onClick={() => router.push('/login')} />



      <section className="w-full max-w-lg mx-auto relative z-10 my-auto">
        <div className="flex flex-col w-full items-center justify-center relative">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-100/30 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-[32rem] h-[32rem] rounded-full bg-amber-100/30 blur-3xl pointer-events-none" />

          <div className="relative w-full z-10">
            <div className="backdrop-blur-2xl bg-white/95 rounded-[32px] p-6 lg:p-8 shadow-2xl flex flex-col justify-between border border-white/80">
              <div>
                <div className="pb-3 border-b border-slate-100">
                  <span className="font-vietnam text-sm font-semibold text-slate-600">Đặt lại mật khẩu</span>
                </div>

                <div className="pt-4 lg:pt-6 flex flex-col items-center text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal mb-3">
                    <span className="material-symbols-outlined text-2xl">key</span>
                  </div>
                  <h1 className="font-vietnam text-2xl lg:text-3xl text-slate-900 font-extrabold tracking-tight">Tạo mật khẩu mới</h1>
                  <p className="font-vietnam text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm">
                    Nhập mã xác thực OTP và mật khẩu mới của bạn bên dưới.
                  </p>
                </div>

                <form
                  action="#"
                  method="POST"
                  className="w-full space-y-3.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(e);
                  }}
                >
                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200/80 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-base text-red-500 shrink-0">error</span>
                      <span className="flex-1">{errorMsg}</span>
                    </div>
                  )}

                  {isSuccess && (
                    <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-brand-teal font-medium flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-base text-brand-teal shrink-0">check_circle</span>
                      <span className="flex-1">Đã cập nhật mật khẩu mới! Đang chuyển về trang chính...</span>
                    </div>
                  )}
                  {/* Email Field */}
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
                      Địa chỉ email <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Nhập địa chỉ email"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm transition-all outline-none text-slate-800 placeholder-slate-400 bg-slate-50/50"
                    />
                  </div>

                  {/* OTP Code Field */}
                  <div>
                    <label htmlFor="reset-code" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
                      Mã OTP (6 chữ số) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, ''));
                        if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
                      }}
                      placeholder="Nhập 6 chữ số OTP"
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-mono tracking-wider transition-all outline-none text-slate-800 placeholder-slate-400 bg-white ${
                        fieldErrors.code
                          ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                          : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
                      }`}
                    />
                    {fieldErrors.code && <p className="mt-1 text-xs text-red-600 pl-1">{fieldErrors.code}</p>}
                  </div>

                  {/* New Password Field */}
                  <div>
                    <label htmlFor="reset-newPassword" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
                      Mật khẩu mới <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reset-newPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                        }}
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        placeholder="Nhập mật khẩu mới"
                        className={`w-full pl-4 pr-10 py-2.5 border rounded-xl text-sm transition-all outline-none text-slate-800 placeholder-slate-400 bg-white ${
                          fieldErrors.newPassword
                            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                            : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <span className="material-symbols-outlined text-lg">visibility_off</span>
                        ) : (
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        )}
                      </button>
                    </div>
                    {fieldErrors.newPassword && <p className="mt-1 text-xs text-red-600 pl-1">{fieldErrors.newPassword}</p>}
                  </div>

                  {/* Confirm New Password Field */}
                  <div>
                    <label htmlFor="reset-confirmPassword" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
                      Xác nhận mật khẩu mới <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="reset-confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }}
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        placeholder="Nhập lại mật khẩu mới"
                        className={`w-full pl-4 pr-10 py-2.5 border rounded-xl text-sm transition-all outline-none text-slate-800 placeholder-slate-400 bg-white ${
                          fieldErrors.confirmPassword
                            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                            : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? (
                          <span className="material-symbols-outlined text-lg">visibility_off</span>
                        ) : (
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-600 pl-1">{fieldErrors.confirmPassword}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isSuccess}
                    className="w-full mt-2 py-3 px-6 rounded-full bg-brand-teal hover:bg-brand-tealLight disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang lưu mật khẩu mới...</span>
                      </>
                    ) : (
                      <>
                        <span>Lưu mật khẩu mới &amp; Đăng nhập</span>
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-xs text-slate-500 hover:text-brand-teal transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Quay lại Đăng nhập</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
