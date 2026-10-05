'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgencyApiError, agencyAuthApi } from './api';
import { AgencyAuthShell } from './AgencyAuthShell';
import type { AgencyOtpPurpose } from './types';

interface AgencyOtpPageProps {
  email: string;
  purpose: AgencyOtpPurpose;
  expiresInSeconds?: number;
}

export function AgencyOtpPage({ email, purpose, expiresInSeconds = 600 }: AgencyOtpPageProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [remaining, setRemaining] = useState(Math.max(0, expiresInSeconds));

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  if (!email) {
    return (
      <AgencyAuthShell eyebrow="Xác thực email" title="Thiếu thông tin xác thực" description="Không tìm thấy email cần xác thực.">
        <Link href="/agency/login" className="block rounded-xl bg-brand-teal px-5 py-3 text-center text-sm font-bold text-white">Quay lại đăng nhập Agency</Link>
      </AgencyAuthShell>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(code)) return setError('Mã OTP phải gồm đúng 6 chữ số.');
    setSubmitting(true);
    try {
      const result = await agencyAuthApi.verifyOtp({ email, code, purpose });
      if (result.registrationComplete) {
        router.replace(`/agency/login?registered=true&email=${encodeURIComponent(result.email)}`);
      } else {
        router.replace('/agency');
      }
    } catch (caught) {
      if (caught instanceof AgencyApiError && caught.code === 'AGENCY_ONBOARDING_REQUIRED') {
        router.replace('/agency/register');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Mã OTP không hợp lệ.');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setNotice('');
    try {
      const result = await agencyAuthApi.resendOtp({ email, purpose });
      setRemaining(result.expiresInSeconds);
      setNotice('Mã OTP mới đã được gửi tới email của bạn.');
    } catch (caught) {
      if (caught instanceof AgencyApiError && caught.code === 'OTP_RESEND_TOO_SOON') {
        setError('Bạn vừa yêu cầu mã. Vui lòng chờ một chút trước khi gửi lại.');
      } else {
        setError(caught instanceof Error ? caught.message : 'Chưa thể gửi lại mã OTP.');
      }
    } finally {
      setResending(false);
    }
  };

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <AgencyAuthShell
      eyebrow={purpose === 'REGISTER' ? 'Bước cuối đăng ký' : 'Bảo mật đăng nhập'}
      title="Xác thực email Agency"
      description={`Nhập mã gồm 6 chữ số đã gửi tới ${email}. Mã chỉ dùng được một lần.`}
      backHref="/agency/login"
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="agency-otp" className="mb-2 block text-sm font-semibold text-slate-700">Mã xác thực</label>
          <input
            id="agency-otp"
            value={code}
            onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="h-16 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center font-mono text-3xl font-bold tracking-[0.45em] text-slate-900 outline-none transition focus:border-brand-tealLight focus:ring-4 focus:ring-cyan-50"
            aria-invalid={Boolean(error)}
          />
          <p className="mt-2 text-center text-xs text-slate-400">Thời gian còn lại: <strong className={remaining === 0 ? 'text-red-600' : 'text-brand-teal'}>{minutes}:{seconds}</strong></p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        <button type="submit" disabled={submitting || code.length !== 6} className="h-12 w-full rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Đang xác thực...' : purpose === 'REGISTER' ? 'Xác thực & hoàn tất đăng ký' : 'Xác thực đăng nhập'}
        </button>
      </form>
      <div className="mt-5 text-center text-sm text-slate-500">
        Chưa nhận được mã?{' '}
        <button type="button" onClick={resend} disabled={resending} className="font-bold text-brand-teal hover:underline disabled:opacity-50">{resending ? 'Đang gửi...' : 'Gửi lại OTP'}</button>
      </div>
    </AgencyAuthShell>
  );
}
