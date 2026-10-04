'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { BackButton } from './BackButton';
import { validateEmail } from '../utils/validation';
import { authApi } from '../api/authApi';

export const ForgotPasswordPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setEmailError(null);

    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setEmailError(emailVal.error || 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email });
      // On success, redirect to verify-otp page with FORGOT_PASSWORD purpose
      router.push(`/verify-otp?email=${encodeURIComponent(email)}&purpose=FORGOT_PASSWORD`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-vietnam text-body-md text-slate-800 flex flex-col justify-center items-center selection:bg-brand-teal selection:text-white relative bg-desk-travel px-4 py-8">
      <AuthBackground />
      <BackButton onClick={() => router.back()} />

      {/* Floating Top-Right Notification Toast */}
      {errorMsg && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-[calc(100vw-3rem)] sm:w-96 p-4 bg-white/95 backdrop-blur-xl border-l-4 border-red-500 rounded-2xl shadow-2xl flex items-start gap-3 text-slate-800 border border-slate-100/80 animate-slide-in-right">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-lg leading-none">error</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-vietnam text-xs font-bold text-red-600 uppercase tracking-wide">Thông báo lỗi</p>
            <p className="font-vietnam text-xs text-slate-700 font-medium mt-0.5 leading-relaxed">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Đóng thông báo"
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>
      )}

      <main className="w-full max-w-lg mx-auto relative z-10 my-auto">
        <div className="flex flex-col w-full items-center justify-center relative">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-100/30 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-[32rem] h-[32rem] rounded-full bg-amber-100/30 blur-3xl pointer-events-none" />

          <div className="relative w-full z-10">
            <div className="backdrop-blur-2xl bg-white/95 rounded-[32px] p-6 lg:p-8 shadow-2xl flex flex-col justify-between border border-white/80">
              <div>
                <div className="pb-3 border-b border-slate-100">
                  <span className="font-vietnam text-sm font-semibold text-slate-600">Khôi phục tài khoản</span>
                </div>

                <div className="pt-4 lg:pt-6 flex flex-col items-center text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal mb-3">
                    <span className="material-symbols-outlined text-2xl">lock_reset</span>
                  </div>
                  <h1 className="font-vietnam text-2xl lg:text-3xl text-slate-900 font-extrabold tracking-tight">Quên mật khẩu?</h1>
                  <p className="font-vietnam text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm">
                    Nhập địa chỉ email đăng ký của bạn. Chúng tôi sẽ gửi mã OTP xác thực để lấy lại mật khẩu.
                  </p>
                </div>

                <form className="w-full space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="user-forgot-email" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-0.5">
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
                        id="user-forgot-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError(null);
                        }}
                        placeholder="Nhập địa chỉ email"
                        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-200 outline-none text-slate-800 placeholder-slate-400 bg-white ${
                          emailError
                            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                            : 'border-slate-200 focus:border-brand-tealLight focus:ring-2 focus:ring-brand-teal/20'
                        }`}
                      />
                    </div>
                    {emailError && <p className="mt-1 text-xs text-red-600 pl-1">{emailError}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 px-6 rounded-full bg-brand-teal hover:bg-brand-tealLight disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang gửi mã xác thực...</span>
                      </>
                    ) : (
                      <>
                        <span>Gửi mã xác thực OTP</span>
                        <span className="material-symbols-outlined text-[18px]">send</span>
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
      </main>
    </div>
  );
};
