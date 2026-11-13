'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { BackButton } from './BackButton';
import { AuthContainer } from './AuthContainer';
import { LoginResultData, RegisterResultData } from '../types';
import { homeForRole } from '../utils/roles';
import { safeNextPath } from '../utils/safeNextPath';

export const LoginPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));

  const handleLoginSuccess = (data: LoginResultData) => {
    if (data.twoFactorRequired) {
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=LOGIN_2FA${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''}`);
      return;
    }

    // Come back to the page the visitor was on (e.g. a tour they wanted to review) when asked to.
    router.push(nextPath ?? homeForRole(data.user.role));
  };

  const handleRegisterSuccess = (data: RegisterResultData) => {
    router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=REGISTER&next=${encodeURIComponent(nextPath ?? homeForRole('TRAVELER'))}`);
  };

  return (
    <div className="min-h-screen text-slate-800 bg-desk-travel flex flex-col items-center justify-center selection:bg-brand-teal selection:text-white relative overflow-hidden px-4 sm:px-6 py-6 sm:py-10">
      {/* Background visual layers */}
      <AuthBackground />

      {/* Expandable Back Button returning to homepage */}
      <BackButton onClick={() => router.push('/home')} />

      {/* Main Centered Auth Container */}
      <section className="w-full flex items-center justify-center relative z-10 my-auto">
        <AuthContainer
          initialMode="login"
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
        />
      </section>
    </div>
  );
};
