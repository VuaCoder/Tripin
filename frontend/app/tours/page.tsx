'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function ToursPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f3] text-[#173640] flex flex-col justify-between p-6 md:p-12">
      <section className="max-w-3xl mx-auto w-full my-auto text-center py-16">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-[#087e8b]/10 text-[#087e8b] mb-6">
          <Sparkles className="size-8" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#087e8b] mb-3">
          Sắp ra mắt
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Danh Sách Tour & Trải Nghiệm
        </h1>
        <p className="text-base md:text-lg text-[#49636b] max-w-xl mx-auto mb-8">
          Trang danh sách tour chi tiết và bộ lọc thông minh đang được hoàn thiện. Vui lòng đăng ký hoặc đăng nhập tài khoản để nhận thông báo sớm nhất!
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-[#087e8b] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#173640] transition-colors"
          >
            Tạo tài khoản ngay
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[#173640]/30 px-6 py-3 text-sm font-bold text-[#173640] hover:bg-[#173640]/5 transition-colors"
          >
            Đăng nhập
          </Link>
        </div>
      </section>

    </div>
  );
}
