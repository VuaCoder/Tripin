'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/features/auth/store/authSlice';
import { AgencyApiError, agencyAuthApi } from './api';
import { AgencyAuthShell } from './AgencyAuthShell';
import { FormField } from './FormField';

interface AgencyLoginPageProps {
  registered?: boolean;
  initialEmail?: string;
}

export function AgencyLoginPage({ registered = false, initialEmail = '' }: AgencyLoginPageProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Vui lòng nhập email hợp lệ.');
    if (!password) return setError('Vui lòng nhập mật khẩu.');

    setSubmitting(true);
    try {
      const result = await agencyAuthApi.login({ email: email.trim().toLowerCase(), password });
      if (result.twoFactorRequired) {
        router.push(`/agency/verify-otp?email=${encodeURIComponent(result.email)}&purpose=LOGIN_2FA`);
      } else {
        dispatch(setCredentials({ accessToken: result.accessToken, user: result.user as any }));
        const verification = result.user.agencyProfile?.verificationStatus;
        if (verification === 'VERIFIED') {
          router.push('/agency');
        } else {
          router.push(`/application-status?email=${encodeURIComponent(result.user.email)}`);
        }
      }
    } catch (caught) {
      if (caught instanceof AgencyApiError && caught.code === 'AGENCY_ONBOARDING_REQUIRED') {
        router.push('/agency/register');
        return;
      }
      if (caught instanceof AgencyApiError && caught.code === 'ACCOUNT_NOT_VERIFIED') {
        // Tài khoản lần đầu đăng nhập chưa xác thực OTP -> tự động chuyển sang trang OTP
        router.push(`/agency/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=REGISTER`);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Đăng nhập chưa thành công. Vui lòng kiểm tra lại tài khoản và mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AgencyAuthShell
      eyebrow="Agency Portal"
      title="Chào mừng đối tác trở lại"
      description="Sử dụng email doanh nghiệp và mật khẩu để tiếp tục vào hệ thống."
    >
      {registered && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm leading-relaxed text-emerald-800 shadow-sm flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-600 shrink-0 mt-0.5">check_circle</span>
          <div>
            <p className="font-bold text-emerald-900">Đăng ký tài khoản Agency thành công!</p>
            <p className="mt-0.5 text-xs text-emerald-700">Vui lòng đăng nhập để tiến hành nhận mã xác thực và hoàn tất hồ sơ.</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField
          label="Email doanh nghiệp"
          name="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(''); }}
          type="email"
          autoComplete="email"
          placeholder="partner@agency.vn"
          required
        />
        <FormField
          label="Mật khẩu"
          name="password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(''); }}
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          required
        />
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <span>Đăng nhập Agency</span>
          )}
        </button>
      </form>
      <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
        Chưa có tài khoản đối tác?{' '}
        <Link href="/agency/register" className="font-bold text-brand-teal hover:underline">
          Đăng ký Agency ngay
        </Link>
      </div>
    </AgencyAuthShell>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
