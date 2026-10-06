'use client';

import Link from 'next/link';
import { Compass, ArrowLeft, Sparkles, MapPin } from 'lucide-react';

export default function ToursPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f3] text-[#173640] flex flex-col justify-between p-6 md:p-12">
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-xl">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#087e8b] text-white">
            <Compass className="size-5" />
          </span>
          <span className="brand-wordmark">TRIPRI</span>
          <span className="text-[#c45438]">.</span>
        </Link>
        <Link 
          href="/" 
          className="flex items-center gap-2 text-sm font-semibold text-[#173640] hover:text-[#087e8b] transition-colors"
        >
          <ArrowLeft className="size-4" /> Trở về Trang chủ
        </Link>
      </header>

      <main className="max-w-3xl mx-auto w-full my-auto text-center py-16">
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
      </main>

      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-[#49636b] pt-8 border-t border-[#173640]/15">
        © 2026 TRIPRI. Những chuyến đi có người ở bên trong.
      </footer>
    </div>
  );
}
