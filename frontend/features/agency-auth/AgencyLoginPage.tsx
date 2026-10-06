'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgencyApiError, agencyAuthApi } from './api';
import { AgencyAuthShell } from './AgencyAuthShell';
import { FormField } from './FormField';

interface AgencyLoginPageProps {
  registered?: boolean;
  initialEmail?: string;
}

export function AgencyLoginPage({ registered = false, initialEmail = '' }: AgencyLoginPageProps) {
  const router = useRouter();
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
        router.push('/agency');
      }
    } catch (caught) {
      if (caught instanceof AgencyApiError && caught.code === 'AGENCY_ONBOARDING_REQUIRED') {
        router.push('/agency/register');
        return;
      }
      if (caught instanceof AgencyApiError && caught.code === 'ACCOUNT_NOT_VERIFIED') {
        router.push(`/agency/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=REGISTER`);
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Đăng nhập chưa thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AgencyAuthShell eyebrow="Agency Portal" title="Chào mừng đối tác trở lại" description="Sử dụng email và mật khẩu của tài khoản đối tác để tiếp tục.">
      {registered && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800">
          <strong>Xác thực email thành công.</strong> Hồ sơ Agency đã được gửi xét duyệt. Bạn có thể đăng nhập ngay.
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Email Agency" name="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} type="email" autoComplete="email" placeholder="partner@agency.vn" required />
        <FormField label="Mật khẩu" name="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required />
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={submitting} className="h-12 w-full rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập Agency'}
        </button>
      </form>
      <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
        Chưa có tài khoản? <Link href="/agency/register" className="font-bold text-brand-teal hover:underline">Đăng ký Agency</Link>
      </div>
    </AgencyAuthShell>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
