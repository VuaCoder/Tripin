'use client';

import React from 'react';
import Link from 'next/link';

export const AuthFooter: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-slate-200/60 bg-white/50 backdrop-blur-md text-xs text-slate-500 z-20">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <span>© 2025 Tripri Inc. Bảo lưu mọi quyền.</span>
          <span className="mx-1">•</span>
          <span className="text-brand-teal font-medium">Du lịch theo cách của bạn</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link href="/terms" className="hover:text-brand-teal transition-colors">
            Điều khoản dịch vụ
          </Link>
          <Link href="/privacy" className="hover:text-brand-teal transition-colors">
            Chính sách bảo mật
          </Link>
          <Link href="/support" className="hover:text-brand-teal transition-colors">
            Liên hệ trợ giúp
          </Link>
        </div>
      </div>
    </footer>
  );
};
