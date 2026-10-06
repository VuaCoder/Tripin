import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="w-full bg-surface-container-low text-on-surface border-t border-surface-container/60">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand & Introduction */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center">
              <Image
                src="/images/tripri-logo.png"
                alt="Tripri Logo with Tagline"
                width={150}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-on-surface-variant max-w-sm mt-1 leading-relaxed">
              Nền tảng kết nối du lịch tự chọn hàng đầu Việt Nam. Khám phá hàng nghìn trải nghiệm chân thực cùng hướng dẫn viên bản địa và đối tác tin cậy.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
              <span className="text-xs font-semibold text-on-surface-variant">
                Đối tác kiểm định 100% • Bảo đảm hoàn tiền
              </span>
            </div>
          </div>

          {/* Dành cho du khách */}
          <div>
            <h3 className="font-semibold text-sm text-on-surface mb-3">Dành cho du khách</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/explore?type=tour" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Khám phá tour
                </Link>
              </li>
              <li>
                <Link href="/custom-trip" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Tour tự chọn
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Trung tâm trợ giúp
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Chính sách &amp; Bảo vệ du khách
                </Link>
              </li>
            </ul>
          </div>

          {/* Hợp tác */}
          <div>
            <h3 className="font-semibold text-sm text-on-surface mb-3">Hợp tác</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/agency" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-tertiary-container">handshake</span>
                  <span>Cổng đối tác</span>
                </Link>
              </li>
              <li>
                <Link href="/guide" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Dành cho hướng dẫn viên
                </Link>
              </li>
              <li>
                <Link href="/agency/register" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Dành cho đại lý &amp; công ty lữ hành
                </Link>
              </li>
            </ul>
          </div>

          {/* Về Tripri */}
          <div>
            <h3 className="font-semibold text-sm text-on-surface mb-3">Về Tripri</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/about" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Về chúng tôi
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Điều khoản &amp; Bảo mật
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-on-surface-variant hover:text-primary transition-colors py-1 block">
                  Liên hệ hỗ trợ 24/7
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-t border-surface-container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <p className="text-center md:text-left">
            © 2025 Tripri Vietnam. Bản quyền thuộc về Tripri Inc.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
              Thanh toán bảo mật SSL
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">public</span>
              Hỗ trợ toàn quốc
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
