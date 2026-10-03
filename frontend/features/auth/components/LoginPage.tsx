'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthBackground } from './AuthBackground';
import { AuthHeader } from './AuthHeader';
import { LoginCard } from './LoginCard';
import { AuthShowcase } from './AuthShowcase';
import { AuthFooter } from './AuthFooter';
import { LoginResultData } from '../types';

export const LoginPage: React.FC = () => {
  const router = useRouter();

  const handleLoginSuccess = (data: LoginResultData) => {
    if (data.twoFactorRequired) {
      // Điều hướng sang trang nhập mã xác thực OTP 2FA
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}&purpose=LOGIN_2FA`);
      return;
    }

    // Điều hướng theo vai trò (Role-based redirection)
    const role = data.user.role;
    switch (role) {
      case 'AGENCY':
        router.push('/agency');
        break;
      case 'TOUR_GUIDE':
        router.push('/guide');
        break;
      case 'MODERATOR':
        router.push('/moderator');
        break;
      case 'SUPER_ADMIN':
        router.push('/super-admin');
        break;
      case 'TRAVELER':
      default:
        router.push('/traveler');
        break;
    }
  };

  return (
    <div className="min-h-screen text-slate-800 bg-desk-travel flex flex-col justify-between selection:bg-brand-teal selection:text-white relative overflow-hidden">
      {/* Background visual layers */}
      <AuthBackground />

      {/* Top Bar Header */}
      <AuthHeader />

      {/* Main Grid Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-8 relative z-10">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Login Card */}
          <LoginCard onSuccess={handleLoginSuccess} />

          {/* Right Column: Tripri Showcase */}
          <AuthShowcase />
        </div>
      </main>

      {/* Footer */}
      <AuthFooter />
    </div>
  );
};
