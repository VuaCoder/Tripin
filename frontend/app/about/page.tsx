'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  ShieldCheck,
  Users,
  Sparkles,
  MapPin,
  CheckCircle2,
  ArrowRight,
  HeartHandshake,
  Scale,
  Award,
  Building2,
  QrCode,
  Headphones,
  FileCheck,
} from 'lucide-react';

export default function AboutPage() {
  const stats = [
    { value: '50+', label: 'Tỉnh thành & Điểm đến' },
    { value: '1,200+', label: 'Chuyến đi hoàn tất' },
    { value: '100%', label: 'Đối tác đã xác minh' },
    { value: '4.9/5', label: 'Mức độ hài lòng' },
  ];

  const coreValues = [
    {
      icon: ShieldCheck,
      title: 'Kiểm định 100% Đối tác',
      description:
        'Tất cả công ty lữ hành đều phải trải qua quy trình xác minh giấy phép kinh doanh lữ hành và hồ sơ pháp lý rõ ràng.',
    },
    {
      icon: Compass,
      title: 'Trải nghiệm bản địa độc bản',
      description:
        'Chúng tôi tin rằng linh hồn của một chuyến đi nằm ở trải nghiệm địa phương. Từng hành trình trên Tripri được thiết kế để du khách chạm vào văn hóa, phong tục và ẩm thực chân thực nhất.',
    },
    {
      icon: Scale,
      title: 'Minh bạch & Trọng tài công bằng',
      description:
        'Chính sách hoàn hủy rõ ràng, bảo vệ quyền lợi tài chính của du khách. Đội ngũ Kiểm duyệt viên (Moderator) sẵn sàng can thiệp giải quyết mọi sự cố phát sinh 24/7.',
    },
    {
      icon: Sparkles,
      title: 'Công nghệ thông minh đồng hành',
      description:
        'Vé điện tử QR code thông minh chống thất lạc, nhắn tin trao đổi trực tiếp tức thì giữa du khách và agency, cùng hệ thống voucher ưu đãi linh hoạt.',
    },
  ];

  const pillars = [
    {
      role: 'Du khách (Traveler)',
      badge: 'Trải nghiệm trọn vẹn',
      icon: Users,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      features: [
        'Tìm kiếm và so sánh hàng trăm tour bản địa đặc sắc theo sở thích',
        'Quản lý vé điện tử QR Code, tra cứu lịch trình chi tiết mọi lúc',
        'Hệ thống đánh giá chân thực từ những du khách đã hoàn thành chuyến đi',
        'Tích điểm thành viên Premium với nhiều voucher giảm giá độc quyền',
      ],
      action: { label: 'Khám phá tour', href: '/tours' },
    },
    {
      role: 'Đơn vị Lữ hành (Agency)',
      badge: 'Quản trị chuyên nghiệp',
      icon: Building2,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      features: [
        'Quản trị danh mục tour, lịch khởi hành và chính sách giá thông minh',
        'Quản lý đội ngũ vận hành và phân bổ lịch trình chuyên nghiệp',
        'Theo dõi doanh thu, lịch sử đơn đặt chỗ và xuất báo cáo vận hành',
        'Phát hành chiến dịch khuyến mãi, voucher để tiếp cận hàng ngàn khách hàng',
      ],
      action: { label: 'Đăng ký đại lý', href: '/agency/register' },
    },
  ];

  const commitments = [
    {
      icon: FileCheck,
      title: 'Tuân thủ pháp luật du lịch',
      desc: 'Hoạt động tuân thủ nghiêm ngặt theo Luật Du lịch Việt Nam và các quy định về thương mại điện tử bảo vệ người tiêu dùng.',
    },
    {
      icon: Headphones,
      title: 'Tổng đài hỗ trợ 24/7',
      desc: 'Đội ngũ chăm sóc khách hàng và hỗ trợ khẩn cấp túc trực thường xuyên để đồng hành cùng bạn trước, trong và sau mỗi hành trình.',
    },
    {
      icon: HeartHandshake,
      title: 'Du lịch có trách nhiệm',
      desc: 'Tripri khuyến khích các hành trình thân thiện với môi trường, tôn trọng cộng đồng bản địa và phát triển kinh tế bền vững.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-container/10 via-primary-container/5 to-transparent px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-container/20 bg-primary-container/10 px-4 py-1.5 text-xs font-semibold text-primary-container sm:text-sm">
            <Sparkles size={16} />
            <span>Về chúng tôi · Tripri Ecosystem</span>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl">
            Kết nối trọn vẹn những{' '}
            <span className="bg-gradient-to-r from-primary-container to-emerald-600 bg-clip-text text-transparent">
              trải nghiệm bản địa
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg md:text-xl">
            Tripri là nền tảng công nghệ du lịch kết nối trực tiếp du khách với các đơn vị lữ hành uy tín
            am hiểu sâu sắc từng vùng đất, mang đến những hành trình du lịch an toàn, chân thực và giàu bản sắc.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tours"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-opacity-90 hover:shadow-md cursor-pointer"
            >
              <span>Khám phá các chuyến đi</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/policies"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <span>Quy chế hoạt động sàn</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="mt-14 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:grid-cols-4 sm:p-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-primary-container sm:text-3xl md:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Sứ mệnh & Tầm nhìn */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Compass size={24} />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-900 sm:text-2xl">Sứ mệnh của chúng tôi</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Giúp mỗi chuyến đi không đơn thuần là điểm check-in lướt qua, mà là một cơ hội thực sự để hòa mình
                vào văn hóa, phong tục, ẩm thực và đời sống của người dân địa phương. Chúng tôi mang công nghệ làm cầu
                nối để xóa bỏ khoảng cách thông tin và rủi ro du lịch.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Award size={24} />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-900 sm:text-2xl">Tầm nhìn dài hạn</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Trở thành hệ sinh thái số tin cậy hàng đầu Việt Nam về du lịch trải nghiệm, nơi quy tụ những người dẫn
                đường tận tâm nhất và các đối tác lữ hành có trách nhiệm, thúc đẩy du lịch bền vững và tôn vinh di sản
                Việt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Giá trị cốt lõi */}
      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Giá trị cốt lõi tại Tripri
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              Mỗi tính năng và quy trình được vận hành tại Tripri đều dựa trên 4 trụ cột đạo đức và trải nghiệm sau:
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {coreValues.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition hover:border-primary-container/40 hover:bg-white hover:shadow-md"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-white text-primary-container shadow-sm ring-1 ring-slate-200 group-hover:bg-primary-container group-hover:text-white transition">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Mô hình 2 phân hệ */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Hệ sinh thái kết nối Du khách &amp; Đơn vị Lữ hành
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              Tripri tạo ra mối liên kết cộng hưởng bền vững giữa Du khách và các Đơn vị lữ hành địa phương uy tín.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.role}
                  className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                        <Icon size={24} />
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.color}`}>
                        {p.badge}
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-slate-900">{p.role}</h3>

                    <ul className="mt-5 space-y-3">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary-container" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 border-t border-slate-100 pt-5">
                    <Link
                      href={p.action.href}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 cursor-pointer"
                    >
                      <span>{p.action.label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Cam kết & Trách nhiệm */}
      <section className="border-t border-slate-200 bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Cam kết vận hành & An toàn
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
              Chúng tôi luôn nỗ lực không ngừng để đem lại môi trường giao dịch văn minh, uy tín và chuẩn mực.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {commitments.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-primary-container shadow-sm ring-1 ring-slate-200/80">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{c.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">{c.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Quick links banner */}
          <div className="mt-12 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-lg">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:text-left text-center">
              <div>
                <h3 className="text-xl font-bold">Cần thêm thông tin hoặc hỗ trợ trực tiếp?</h3>
                <p className="mt-1.5 text-sm text-slate-300">
                  Xem chi tiết các quy định pháp lý, điều khoản hoàn tiền hoặc gửi yêu cầu cho chúng tôi.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/policies"
                  className="rounded-xl bg-white/10 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 cursor-pointer"
                >
                  Chính sách & Điều khoản
                </Link>
                <Link
                  href="/home"
                  className="rounded-xl bg-primary-container px-5 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-opacity-90 cursor-pointer"
                >
                  Về trang chủ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

