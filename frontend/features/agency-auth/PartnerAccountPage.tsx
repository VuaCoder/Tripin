'use client';

import { useEffect, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { GoogleLoginButton } from '@/features/auth/components/GoogleLoginButton';
import { AuthBackground } from '@/features/auth/components/AuthBackground';
import { useLoginForm } from '@/features/auth/hooks/useLoginForm';
import { useRegisterForm } from '@/features/auth/hooks/useRegisterForm';
import { authNextPath } from '@/features/auth/utils/safeNextPath';
import type { LoginResultData } from '@/features/auth/types';
import { FormField } from './FormField';
import styles from '@/features/agency/Workplace.module.css';

export function PartnerAccountPage({ mode = 'login', initialEmail = '', registered = false }: { mode?: 'login' | 'register'; initialEmail?: string; registered?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const status = useAppSelector(s => s.auth.status);
  const next = authNextPath(params.get('next'), '/workplaces');
  const verified = (data: LoginResultData) => {
    if (data.twoFactorRequired) router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=LOGIN_2FA&next=${encodeURIComponent(next)}${login.formData.rememberMe ? '&rememberMe=true' : ''}`);
    else router.push(next);
  };
  const login = useLoginForm({ onSuccess: verified, continuation: next, initialEmail });
  const registration = useRegisterForm({ onSuccess: data => router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=REGISTER&next=${encodeURIComponent(next)}`) });
  useEffect(() => { if (status === 'authenticated') router.replace(next); }, [status, next, router]);
  const isRegister = mode === 'register';
  const busy = isRegister ? registration.isLoading : login.isLoading;
  const error = isRegister ? registration.errors.general : login.errors.general;
  const inputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isRegister) registration.handleInputChange(event as ChangeEvent<HTMLInputElement>);
    else login.handleInputChange(event as ChangeEvent<HTMLInputElement>);
  };
  return <main className={`${styles.auth} bg-desk-travel`}>
    <AuthBackground />
    <section className={styles.authCard} aria-labelledby="partner-account-title">
      <aside className={styles.authAside}>
        <Link href="/" aria-label="Về Tripri"><img src="/images/tripri-logo.png" alt="Tripri" /></Link>
        <div><h2>Một tài khoản.<br />Nhiều nơi làm việc.</h2><p>Tạo doanh nghiệp của bạn hoặc tham gia đội ngũ đang làm việc trên Tripri.</p></div>
        <small>Vai trò của bạn được quản lý riêng trong từng doanh nghiệp.</small>
      </aside>
      <div className={styles.authBody}>
        <div className={styles.eyebrow}>Tripri Partner</div>
        <h1 id="partner-account-title">{isRegister ? 'Tạo tài khoản của bạn' : 'Đăng nhập để tiếp tục'}</h1>
        <p>{isRegister ? 'Bắt đầu với tài khoản cá nhân. Bạn sẽ chọn doanh nghiệp sau khi xác minh email.' : 'Dùng tài khoản Tripri của bạn, kể cả khi chưa tham gia doanh nghiệp nào.'}</p>
        {registered && <p className={styles.notice}>Tài khoản đã được tạo. Đăng nhập để tiếp tục xác minh email nếu cần.</p>}
        <form onSubmit={isRegister ? registration.handleSubmit : login.handleSubmit} noValidate>
          <fieldset disabled={busy} className={styles.authFields}>
            {isRegister && <FormField label="Họ và tên" name="fullName" value={registration.formData.fullName} onChange={inputChange} autoComplete="name" required error={registration.errors.fullName} />}
            <FormField label="Email" name={isRegister ? 'email' : 'credential'} type="email" value={isRegister ? registration.formData.email : login.formData.credential} onChange={inputChange} autoComplete="email" required error={isRegister ? registration.errors.email : login.errors.credential} />
            {isRegister && <FormField label="Số điện thoại" name="phone" type="tel" value={registration.formData.phone} onChange={inputChange} autoComplete="tel" required error={registration.errors.phone} />}
            <FormField label="Mật khẩu" name="password" type="password" value={isRegister ? registration.formData.password : login.formData.password} onChange={inputChange} autoComplete={isRegister ? 'new-password' : 'current-password'} required error={isRegister ? registration.errors.password : login.errors.password} />
            {isRegister && <FormField label="Xác nhận mật khẩu" name="confirmPassword" type="password" value={registration.formData.confirmPassword} onChange={inputChange} autoComplete="new-password" required error={registration.errors.confirmPassword} />}
          </fieldset>
          {!isRegister && <div className={styles.authOptions}><label><input type="checkbox" name="rememberMe" checked={Boolean(login.formData.rememberMe)} onChange={login.handleInputChange} disabled={busy} />Ghi nhớ đăng nhập</label><Link href="/forgot-password">Quên mật khẩu?</Link></div>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={`${styles.primary} ${styles.full}`} style={isRegister ? { marginTop: 24 } : undefined} disabled={busy}>{busy ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
        <div className={styles.divider}>hoặc</div>
        <GoogleLoginButton onSuccess={verified} disabled={busy} rememberMe={Boolean(login.formData.rememberMe)} label="Tiếp tục với Google" />
        <p className={styles.authSwitch}>{isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}<Link href={`${isRegister ? '/agency/login' : '/agency/register'}${params.get('next') ? '?next=' + encodeURIComponent(next) : ''}`}>{isRegister ? 'Đăng nhập' : 'Tạo tài khoản'}</Link></p>
        <p className={styles.authSwitch}><Link href="/">Về Tripri</Link></p>
      </div>
    </section>
  </main>;
}
