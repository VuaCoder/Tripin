'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Lock,
  Compass,
  Building2,
  Globe,
} from 'lucide-react';
import { Container } from './Container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800">
      {/* Main Footer Content */}
      <Container className="pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">
          {/* Column 1: Brand & Official Contact (2 cols on large screen) */}
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
              Nền tảng công nghệ kết nối du lịch trải nghiệm bản địa toàn diện tại Việt Nam. Đồng hành cùng các đơn vị lữ hành uy tín và hướng dẫn viên địa phương am hiểu sâu sắc.
            </p>

            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-800/90 border border-slate-700/70 px-3.5 py-2 w-fit">
              <ShieldCheck className="size-4 text-teal-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">
                100% Đối tác kiểm định · Giao dịch minh bạch
              </span>
            </div>

            {/* Contact Information */}
            <div className="flex flex-col gap-2 text-xs text-slate-400 mt-1">
              <div className="flex items-center gap-2.5">
                <Phone className="size-3.5 text-teal-400 shrink-0" />
                <span>
                  Hotline hỗ trợ: <strong className="text-slate-200 font-semibold">1900 6868</strong> (24/7)
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="size-3.5 text-teal-400 shrink-0" />
                <span>
                  Email liên hệ: <strong className="text-slate-200 font-semibold">hotro@tripri.vn</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="size-3.5 text-teal-400 shrink-0" />
                <span>Văn phòng điều hành: TP. Hồ Chí Minh, Việt Nam</span>
              </div>
            </div>
          </div>

          {/* Column 2: Về Tripri */}
          <div>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
              Về Tripri
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              <li>
                <Link href="/about" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Giới thiệu Tripri
                </Link>
              </li>
              <li>
                <Link href="/premium" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Gói hội viên Premium
                </Link>
              </li>
              <li>
                <Link href="/policies" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Quy chế hoạt động sàn
                </Link>
              </li>
              <li>
                <Link href="/policies" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Chính sách &amp; Điều khoản
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Dành cho du khách */}
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
                <Link href="/settings/history" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Chuyến đi &amp; Vé điện tử
                </Link>
              </li>
              <li>
                <Link href="/settings/wishlist" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Danh sách yêu thích
                </Link>
              </li>
              <li>
                <Link href="/settings/vouchers" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Ví voucher ưu đãi
                </Link>
              </li>
              <li>
                <Link href="/settings/reports" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Khiếu nại &amp; Báo cáo
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Hợp tác & Phát triển */}
          <div>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-4">
              Hợp tác &amp; Phát triển
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-slate-400">
              <li>
                <Link
                  href="/agency"
                  className="hover:text-teal-400 transition-colors py-0.5 inline-flex items-center gap-1.5 font-medium text-teal-300"
                >
                  <Building2 className="size-4" />
                  <span>Cổng đối tác lữ hành</span>
                </Link>
              </li>
              <li>
                <Link href="/guide" className="hover:text-teal-400 transition-colors py-0.5 inline-flex items-center gap-1.5">
                  <Compass className="size-4" />
                  <span>Cổng hướng dẫn viên</span>
                </Link>
              </li>
              <li>
                <Link href="/agency/register" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Đăng ký đại lý lữ hành
                </Link>
              </li>
              <li>
                <Link href="/register/guide" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Đăng ký làm Tour Guide
                </Link>
              </li>
              <li>
                <Link href="/application-status" className="hover:text-teal-400 transition-colors py-0.5 inline-block">
                  Tra cứu duyệt hồ sơ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Gateway & Security Trust Row */}
        <div className="pt-8 pb-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-slate-300 mr-1">Cổng thanh toán tích hợp:</span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-3 py-1 font-bold text-teal-300">
              PayOS
            </span>
            <span className="rounded-md bg-slate-800/90 border border-slate-700 px-3 py-1 font-bold text-teal-300">
              VietQR
            </span>
            <span className="text-slate-500 text-[11px] ml-1">
              (Thanh toán quét mã QR chuyển khoản tức thì 24/7)
            </span>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <Lock className="size-3.5 text-teal-400 shrink-0" />
              Mã hóa SSL/TLS 256-bit
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="size-3.5 text-teal-400 shrink-0" />
              Bảo vệ quyền lợi giao dịch 100%
            </span>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Region */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="text-center sm:text-left">
            © {currentYear} Tripri Platform. Nền tảng kết nối du lịch trải nghiệm bản địa. Toàn bộ bản quyền được bảo lưu.
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
              <Globe className="size-3.5 text-slate-400" />
              Việt Nam
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-medium">
              Tiếng Việt (VN)
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-medium">
              ₫ VNĐ
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
