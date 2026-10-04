'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  fallbackUrl?: string;
  onClick?: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ fallbackUrl = '/', onClick }) => {
  const router = useRouter();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <button
      onClick={handleBack}
      type="button"
      aria-label="Quay lại"
      className="fixed top-5 left-5 z-30 group flex items-center h-10 px-3 bg-white/80 hover:bg-white backdrop-blur-md rounded-full shadow-md hover:shadow-lg border border-white/80 text-slate-700 hover:text-brand-teal transition-all duration-300 ease-in-out outline-none cursor-pointer"
    >
      <svg
        className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      <span className="max-w-0 group-hover:max-w-[100px] opacity-0 group-hover:opacity-100 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out text-xs sm:text-sm font-semibold group-hover:ml-1.5">
        Quay lại
      </span>
    </button>
  );
};
