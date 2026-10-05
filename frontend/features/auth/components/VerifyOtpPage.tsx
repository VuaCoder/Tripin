'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { BackButton } from './BackButton';
import { useVerifyOtpMutation, useResendOtpMutation } from '../api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '../store/authSlice';
import { homeForRole } from '../utils/roles';
import { getApiErrorMessage } from '../utils/apiError';
import type { ResendOtpPurpose, VerifyOtpPurpose } from '../types';

interface VerifyOtpPageProps {
  email?: string;
  purpose?: string;
}

export const VerifyOtpPage: React.FC<VerifyOtpPageProps> = ({ email, purpose = 'REGISTER' }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [verifyOtp] = useVerifyOtpMutation();
  const [resendOtp] = useResendOtpMutation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes OTP TTL
  const [resendCooldown, setResendCooldown] = useState(60); // 1 minute resend cooldown
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendToast, setResendToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
       // handle paste
       const pastedData = value.replace(/\D/g, '').slice(0, 6).split('');
       const newOtp = [...otp];
       pastedData.forEach((char, i) => {
          if (index + i < 6) newOtp[index + i] = char;
       });
       setOtp(newOtp);
       const nextIndex = Math.min(index + pastedData.length, 5);
       inputRefs.current[nextIndex]?.focus();
       setErrorMsg(null);
       return;
    }

    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrorMsg(null);
    setIsSuccess(false);

    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedText) return;

    const newOtp = [...otp];
    const chars = pastedText.split('');
    chars.forEach((char, i) => {
      if (index + i < 6) newOtp[index + i] = char;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(index + chars.length, 5);
    inputRefs.current[nextIndex]?.focus();
    setErrorMsg(null);
    setIsSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) {
      setErrorMsg('Vui lòng nhập đủ 6 chữ số mã xác thực.');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      const data = await verifyOtp({
        email: email || '',
        code: otpValue,
        purpose: purpose as VerifyOtpPurpose,
      }).unwrap();

      dispatch(setCredentials(data));
      setIsSuccess(true);
      setTimeout(() => {
        if (purpose === 'FORGOT_PASSWORD') {
          router.push(`/reset-password?email=${encodeURIComponent(email || '')}&code=${encodeURIComponent(otpValue)}`);
        } else {
          router.push(homeForRole(data.user.role));
        }
      }, 1200);
    } catch (err) {
      const msg = getApiErrorMessage(err, '');
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('hết hạn')) {
        setErrorMsg('Mã xác thực đã hết hạn. Vui lòng bấm gửi lại mã mới.');
      } else if (msg.toLowerCase().includes('quá số lần') || msg.toLowerCase().includes('too many')) {
        setErrorMsg('Đã nhập sai quá số lần quy định. Vui lòng gửi lại mã mới.');
      } else {
        setErrorMsg('Mã xác thực không chính xác. Vui lòng kiểm tra lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setErrorMsg(null);
    
    try {
      await resendOtp({ email: email || '', purpose: purpose as ResendOtpPurpose }).unwrap();
      setTimeLeft(600);
      setResendCooldown(60);
      setResendToast(true);
      setTimeout(() => setResendToast(false), 3500);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setIsSuccess(false);
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.'));
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div className="min-h-screen font-vietnam text-body-md text-slate-800 flex flex-col justify-center items-center selection:bg-brand-teal selection:text-white relative bg-desk-travel px-4 py-8">
      <AuthBackground />
      {/* Back button navigates to previous page */}
      <BackButton onClick={() => router.back()} />

      {/* Floating Top-Right Notification Toast */}
      {(errorMsg || isSuccess || resendToast) && (
        <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-[calc(100vw-3rem)] sm:w-96 pointer-events-auto animate-slide-in-right">
          {errorMsg && (
            <div className="w-full p-4 bg-white/95 backdrop-blur-xl border-l-4 border-red-500 rounded-2xl shadow-2xl flex items-start gap-3 text-slate-800 border border-slate-100/80">
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

          {isSuccess && (
            <div className="w-full p-4 bg-white/95 backdrop-blur-xl border-l-4 border-brand-teal rounded-2xl shadow-2xl flex items-start gap-3 text-slate-800 border border-slate-100/80">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-brand-teal shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-lg leading-none">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-vietnam text-xs font-bold text-brand-teal uppercase tracking-wide">Thành công</p>
                <p className="font-vietnam text-xs text-slate-700 font-medium mt-0.5 leading-relaxed">Xác thực OTP thành công! Đang chuyển hướng...</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Đóng thông báo"
              >
                <span className="material-symbols-outlined text-base leading-none">close</span>
              </button>
            </div>
          )}

          {resendToast && (
            <div className="w-full p-4 bg-white/95 backdrop-blur-xl border-l-4 border-blue-500 rounded-2xl shadow-2xl flex items-start gap-3 text-slate-800 border border-slate-100/80">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-lg leading-none">mark_email_read</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-vietnam text-xs font-bold text-blue-600 uppercase tracking-wide">Đã gửi mã mới</p>
                <p className="font-vietnam text-xs text-slate-700 font-medium mt-0.5 leading-relaxed">Mã OTP mới đã được gửi tới email của bạn.</p>
              </div>
              <button
                type="button"
                onClick={() => setResendToast(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Đóng thông báo"
              >
                <span className="material-symbols-outlined text-base leading-none">close</span>
              </button>
            </div>
          )}
        </div>
      )}

      <main className="w-full max-w-xl mx-auto relative z-10 my-auto">
        <div className="flex flex-col w-full items-center justify-center relative">
          {/* Ambient Atmospheric Backdrops */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-100/30 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-[32rem] h-[32rem] rounded-full bg-amber-100/30 blur-3xl pointer-events-none" />
          
          <div className="relative w-full z-10">
            {/* OTP Verification Form Card */}
            <div className="backdrop-blur-2xl bg-white/95 rounded-[32px] p-6 lg:p-8 shadow-2xl flex flex-col justify-between border border-white/80">
              <div>
                <div className="pt-2 sm:pt-4 flex flex-col items-center text-center mb-6">
                  <h1 className="font-vietnam text-2xl lg:text-3xl text-slate-900 font-extrabold tracking-tight">Xác thực mã OTP</h1>
                  <p className="font-vietnam text-xs sm:text-sm text-slate-500 mt-1 max-w-md">
                    Chúng tôi đã gửi mã xác thực bảo mật gồm 6 chữ số đến tài khoản của bạn
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 bg-slate-100/80 px-4 py-1.5 rounded-full border border-slate-200/60">
                    <span className="material-symbols-outlined text-sm text-brand-teal leading-none">mail</span>
                    <span className="font-vietnam text-xs sm:text-sm text-slate-800 font-semibold">{email || 'user@example.com'}</span>
                  </div>
                </div>

                <form className="flex flex-col items-center" onSubmit={handleSubmit}>
                  <div className="w-full max-w-md">
                    {/* 6 Digit Input Boxes */}
                    <div className="flex justify-between items-center gap-2">
                      {otp.map((val, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            if (el) inputRefs.current[idx] = el;
                          }}
                          className={`otp-input w-11 h-13 sm:w-14 sm:h-16 text-center font-vietnam text-xl sm:text-2xl font-bold text-slate-900 bg-white rounded-2xl border-2 ${
                            errorMsg
                              ? 'border-red-400 text-red-600 bg-red-50/20 ring-2 ring-red-100'
                              : isSuccess
                              ? 'border-teal-500 text-brand-teal bg-teal-50/20 ring-2 ring-teal-100'
                              : 'border-slate-200 focus:border-brand-tealLight shadow-sm focus:ring-4 focus:ring-brand-teal/20'
                          } focus:outline-none transition-all select-all`}
                          maxLength={6}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={val}
                          onChange={(e) => handleChange(idx, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(idx, e)}
                          onPaste={(e) => handlePaste(e, idx)}
                        />
                      ))}
                    </div>

                    {/* Submit Button with Loading State */}
                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess}
                      className="mt-6 w-full bg-brand-teal hover:bg-brand-tealLight disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-vietnam font-bold py-3.5 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-[0.99] flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Đang xác thực...</span>
                        </>
                      ) : (
                        <>
                          <span>Xác thực OTP</span>
                          <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </>
                      )}
                    </button>
                    
                    {/* Resend OTP Row (Left: Text & 60s Countdown, Right: Resend Button) */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 font-vietnam text-xs sm:text-sm">
                      <div className="text-slate-500 font-medium flex items-center gap-1.5">
                        <span>Mã không được gửi tới?</span>
                        {resendCooldown > 0 && (
                          <span className="font-bold text-brand-teal font-mono bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                            {resendCooldown}s
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={isResending || resendCooldown > 0}
                        className="py-2 px-4 rounded-xl border border-slate-200 hover:border-brand-teal text-slate-700 hover:text-brand-teal disabled:opacity-40 disabled:cursor-not-allowed bg-white font-vietnam font-semibold text-xs transition-all duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isResending ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-brand-teal" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Đang gửi...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base text-brand-teal">replay</span>
                            <span>Gửi lại mã</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};
