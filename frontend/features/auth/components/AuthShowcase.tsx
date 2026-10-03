'use client';

import React from 'react';
import Image from 'next/image';

export const AuthShowcase: React.FC = () => {
  return (
    <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left order-1 lg:order-2 px-2 sm:px-6">
      {/* Large Official Tripri Logo Image */}
      <div className="max-w-md w-full mb-6 flex justify-center lg:justify-start">
        <img
          alt="Tripri Official Logo"
          className="w-full max-w-[360px] h-auto object-contain drop-shadow-sm"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTeBb0xH9sFeWAg7sRvmPby6qQYwJ0CU5gwv491f3eFc-RVyijDySo44UqC6ekXxGe_MM8OkKrBnRQRsKRsRGorre3PiVfVD6XWkA4-bkTDSbEUN2gNg2qLNPt323ieSoxaWS9biQWXpZH1grXPFbEo5IupwrugWo4AKvRmxhsnyzosCHomafpNSj8lwiQ17RmPTnM_saw3AEAOPF7aVF1vXXXXyb5RI0uhYW2sfXO8nUfwlZvLVxgaPbb_8yDHkWRWATkWwxzlIJF6aQ"
        />
      </div>

      {/* Concise Punchy Headline */}
      <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-brand-tealDark tracking-tight leading-tight">
        Trọn vẹn kỳ nghỉ trong một chạm.
      </h1>

      {/* 1-line Subtitle mentioning core booking services */}
      <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
        Nền tảng đặt phòng, phương tiện, dịch vụ vui chơi, tour &amp; trải nghiệm bản địa toàn diện.
      </p>

      {/* Core Booking Features Grid - Frosted Glassmorphism */}
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-xl">
        {/* Item 1: Khách sạn & Lưu trú */}
        <div className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-white/80 border border-white/95 shadow-[0_12px_32px_-6px_rgba(8,126,139,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-[0_16px_36px_-6px_rgba(8,126,139,0.25)] group">
          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-brand-teal flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Khách sạn &amp; Lưu trú</h4>
            <p className="text-xs font-medium text-slate-600 mt-1 leading-normal">Giá tốt, giữ phòng 100%</p>
          </div>
        </div>

        {/* Item 2: Vé xe & Di chuyển */}
        <div className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-white/80 border border-white/95 shadow-[0_12px_32px_-6px_rgba(8,126,139,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-[0_16px_36px_-6px_rgba(8,126,139,0.25)] group">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-brand-orange flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect height="13" width="15" x="1" y="3" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Vé xe &amp; Di chuyển</h4>
            <p className="text-xs font-medium text-slate-600 mt-1 leading-normal">Đón tận nơi, tiện lợi</p>
          </div>
        </div>

        {/* Item 3: Tour & Trải nghiệm */}
        <div className="relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-white/80 border border-white/95 shadow-[0_12px_32px_-6px_rgba(8,126,139,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-[0_16px_36px_-6px_rgba(8,126,139,0.25)] group">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 flex-shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-900 leading-tight">Tour &amp; Trải nghiệm</h4>
            <p className="text-xs font-medium text-slate-600 mt-1 leading-normal">Bản địa hóa theo gu riêng</p>
          </div>
        </div>
      </div>

      {/* Verified Trust Badge */}
      <div className="mt-6 flex items-center gap-2 text-slate-600 text-xs font-medium bg-white/40 border border-white/80 px-3.5 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
        <svg className="w-4 h-4 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>
          Hơn <strong>10.000+</strong> dịch vụ phòng, vé xe &amp; tour trên toàn quốc
        </span>
      </div>
    </div>
  );
};
