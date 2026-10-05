'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { BackButton } from './BackButton';
import { AuthContainer } from './AuthContainer';
import { LoginResultData, RegisterableRole, RegisterResultData } from '../types';
import { homeForRole } from '../utils/roles';

interface RegisterPageProps {
  /** Which account type this register page creates. Defaults to `TRAVELER`. */
  role?: RegisterableRole;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ role = 'TRAVELER' }) => {
  const router = useRouter();

  const handleLoginSuccess = (data: LoginResultData) => {
    if (data.twoFactorRequired) {
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=LOGIN_2FA`);
      return;
    }

    router.push(homeForRole(data.user.role));
  };

  const handleRegisterSuccess = (data: RegisterResultData) => {
    router.push(`/login?registered=true&email=${encodeURIComponent(data.email)}`);
  };

  return (
    <div className="min-h-screen text-slate-800 bg-desk-travel flex flex-col items-center justify-center selection:bg-brand-teal selection:text-white relative overflow-hidden px-4 sm:px-6 py-6 sm:py-10">
      {/* Background visual layers */}
      <AuthBackground />

      {/* Expandable Back Button returning to homepage */}
      <BackButton onClick={() => router.push('/')} />

      {/* Main Centered Auth Container */}
      <main className="w-full flex items-center justify-center relative z-10 my-auto">
        <AuthContainer
          initialMode="register"
          registerRole={role}
          onLoginSuccess={handleLoginSuccess}
          onRegisterSuccess={handleRegisterSuccess}
        />
      </main>
    </div>
  );
};
