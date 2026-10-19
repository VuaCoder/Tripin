'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Container } from './Container';

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const currentYear = new Date().getFullYear();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800">
      {/* Main Footer Content */}
      <Container className="pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">
          {/* Column 1: Brand & Introduction */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Link href="/home" className="inline-block">
              <Image
                src="/images/tripri-logo.png"
                alt="Tripri - Du lịch theo cách của bạn"
                width={150}
                height={40}
                className="h-9 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Nền tảng kết nối du lịch tự chọn hàng đầu Việt Nam. Khám phá hàng nghìn trải nghiệm chân thực cùng hướng dẫn viên bản địa và đối tác lữ hành tin cậy.
            </p>

            {/* Trust badge */}
            <div className="inline-flex items-center gap-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 px-3.5 py-2 w-fit">
              <span className="material-symbols-outlined text-teal-400 text-[20px]">verified_user</span>
              <span className="text-xs font-semibold text-slate-200">
                100% Đối tác kiểm định • Hoàn tiền minh bạch
              </span>
            </div>

            {/* Contact quick links */}
            <div className="flex flex-col gap-1.5 text-xs text-slate-400 mt-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-teal-400">call</span>
                <span>Hotline: <strong className="text-slate-200 font-semibold">1900 6868</strong> (24/7)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-teal-400">mail</span>
                <span>Email: <strong className="text-slate-200 font-semibold">hotro@tripri.vn</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-teal-400">location_on</span>
                <span>Tòa nhà Tripri, Quận 1, TP. Hồ Chí Minh</span>
              </div>
            </div>
          </div>

          {/* Column 2: Dành cho du khách */}
          <div>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
              Dành cho du khách
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              <li>
                <Link href="/tours" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Khám phá tour du lịch
                </Link>
              </li>
              <li>
                <Link href="/explore" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Điểm đến thịnh hành
                </Link>
              </li>
              <li>
                <Link href="/custom-trip" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Tour thiết kế riêng
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Trung tâm trợ giúp
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Chính sách bảo vệ du khách
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hợp tác & Đối tác */}
          <div>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
              Hợp tác &amp; Phát triển
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              <li>
                <Link href="/agency" className="hover:text-teal-400 transition-colors py-0.5 inline-flex items-center gap-1.5 font-medium text-teal-300">
                  <span className="material-symbols-outlined text-[16px]">handshake</span>
                  <span>Cổng đối tác lữ hành</span>
                </Link>
              </li>
              <li>
                <Link href="/guide" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Cổng hướng dẫn viên
                </Link>
              </li>
              <li>
                <Link href="/register/guide" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Đăng ký làm Tour Guide
                </Link>
              </li>
              <li>
                <Link href="/agency/register" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Đăng ký đại lý du lịch
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Quy chế hoạt động sàn
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Bản tin & Mạng xã hội */}
          <div>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
              Nhận tin ưu đãi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Đăng ký để nhận voucher giảm đến 30% và cẩm nang du lịch độc quyền từ Tripri.
            </p>

            {subscribed ? (
              <div className="rounded-xl bg-teal-950/80 border border-teal-800 text-teal-300 text-xs p-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Cảm ơn bạn! Chúng tôi sẽ gửi ưu đãi sớm nhất.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email của bạn..."
                    required
                    aria-label="Email nhận bản tin"
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs py-2.5 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Đăng ký nhận tin</span>
                </button>
              </form>
            )}

            {/* Social Icons */}
            <div className="mt-5">
              <span className="text-xs font-semibold text-slate-300 block mb-2">Kết nối với chúng tôi</span>
              <div className="flex items-center gap-2">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook Tripri"
                  className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-teal-600 hover:text-white transition-all"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Tripri"
                  className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-teal-600 hover:text-white transition-all"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube Tripri"
                  className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-teal-600 hover:text-white transition-all"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                <a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok Tripri"
                  className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-teal-600 hover:text-white transition-all"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.55c0 1.9-.53 3.86-1.64 5.39-1.28 1.77-3.32 2.89-5.51 3.04-1.99.14-4.04-.45-5.65-1.66-1.68-1.26-2.73-3.23-2.85-5.32-.14-2.31.81-4.67 2.49-6.21 1.64-1.51 3.97-2.27 6.18-1.98v4.11c-1.07-.3-2.29-.16-3.24.42-.9.56-1.49 1.59-1.5 2.67-.02 1.18.57 2.33 1.57 2.94.94.57 2.15.65 3.16.23.95-.39 1.57-1.35 1.58-2.37V.02h.56z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & Security Trust Row */}
        <div className="pt-8 pb-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-300 mr-1">Đối tác thanh toán:</span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2.5 py-1 font-bold text-slate-200">
              PayOS
            </span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2.5 py-1 font-bold text-slate-200">
              VietQR
            </span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2.5 py-1 font-bold text-slate-200">
              Visa / Mastercard
            </span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-2.5 py-1 font-bold text-slate-200">
              ATM Nội địa
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-teal-400">lock</span>
              Bảo mật SSL 256-bit
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-teal-400">shield</span>
              Bảo đảm quyền lợi 100%
            </span>
          </div>
        </div>

        {/* Bottom Bar: Real-time Year Copyright & Locale */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="text-center sm:text-left">
            © {currentYear} Tripri Inc. Nền tảng kết nối du lịch tự chọn hàng đầu Việt Nam. Toàn bộ bản quyền được bảo lưu.
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
              <span className="material-symbols-outlined text-[15px] text-slate-400">language</span>
              Tiếng Việt (VN)
            </span>
            <span className="text-slate-600">•</span>
            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
              ₫ VNĐ
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
