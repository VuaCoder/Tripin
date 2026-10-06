'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const chapters = [
  {
    number: '01',
    kicker: 'Tìm thấy chuyến đi',
    title: 'Mọi hành trình bắt đầu từ một nơi bạn muốn hiểu hơn.',
    body: 'TRIPRI đưa những điểm đến, tour trải nghiệm và lịch trình phù hợp về cùng một nơi. Tìm theo địa danh, ngày khởi hành hoặc điều bạn muốn làm — từ một ngày trên vịnh đến một hành trình nhiều ngày qua miền núi.',
    side: 'Không còn phải mở nhiều trang để ghép từng mảnh của chuyến đi.',
    image: '/images/story-local-guide.png',
  },
  {
    number: '02',
    kicker: 'Biết rõ trước khi đặt',
    title: 'Một chuyến đi tốt nên bắt đầu bằng sự rõ ràng.',
    body: 'Xem lịch trình từng ngày, thời lượng, điểm đón, số chỗ còn lại và những gì đã bao gồm. Bạn biết mình sẽ đi đâu, làm gì và cần chuẩn bị gì trước khi quyết định.',
    side: 'Thông tin đầy đủ để lựa chọn bằng sự yên tâm, không phải phỏng đoán.',
    image: '/images/destination-ninh-binh.png',
  },
  {
    number: '03',
    kicker: 'Đặt trọn trong một nơi',
    title: 'Từ lựa chọn đầu tiên đến tấm vé điện tử.',
    body: 'Khi đã tìm thấy tour phù hợp, kiểm tra tình trạng chỗ, đặt và thanh toán trực tuyến ngay trên TRIPRI. Xác nhận đặt chỗ và e-ticket được gửi về để bạn luôn có thông tin cần thiết trong tay.',
    side: 'Ít bước hơn. Ít cuộc gọi hơn. Nhiều thời gian hơn cho chính chuyến đi.',
    image: '/images/hero-vietnam.png',
  },
  {
    number: '04',
    kicker: 'Đi cùng người đáng tin',
    title: 'Kết nối với những người hiểu nơi họ dẫn bạn đến.',
    body: 'TRIPRI kết nối bạn với các công ty du lịch và hướng dẫn viên đáng tin cậy — những đối tác tạo ra trải nghiệm thật, vận hành chuyến đi và chăm sóc bạn trên đường.',
    side: 'Một nền tảng chung cho người đi, người tổ chức và người dẫn đường.',
    image: '/images/story-local-guide.png',
  },
];

function ScrubWords({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, idx) => (
        <span
          key={idx}
          className="scrub-word inline-block mr-[0.24em] will-change-[opacity]"
        >
          {word}
        </span>
      ))}
    </span>
  );
}

// 3D Magnetic Button Component - Áp dụng HIỆU ỨNG TILT PARALLAX CHỈ CHO NÚT NÀY!
function Tilt3DButton({
  children,
  href,
  className = '',
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const btn = btnRef.current;
    const inner = innerRef.current;
    if (!btn || !inner) return;
    
    // GSAP quickTo for buttery smooth performance without re-renders
    const xTo = gsap.quickTo(inner, "rotationY", { ease: "power3.out", duration: 0.4 });
    const yTo = gsap.quickTo(inner, "rotationX", { ease: "power3.out", duration: 0.4 });
    const transXTo = gsap.quickTo(inner, "x", { ease: "power3.out", duration: 0.4 });
    const transYTo = gsap.quickTo(inner, "y", { ease: "power3.out", duration: 0.4 });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -25; 
      const rotateY = ((x - centerX) / centerX) * 25;
      
      const shiftX = ((x - centerX) / centerX) * 12;
      const shiftY = ((y - centerY) / centerY) * 12;

      xTo(rotateY);
      yTo(rotateX);
      transXTo(shiftX);
      transYTo(shiftY);
      
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255, 255, 255, 0.5) 0%, transparent 60%)`;
      }
    };

    const handleMouseEnter = () => {
       if (glowRef.current) gsap.to(glowRef.current, { opacity: 1, duration: 0.3 });
       gsap.to(inner, { scale: 1.05, duration: 0.3, ease: "power2.out" });
    };

    const handleMouseLeave = () => {
       xTo(0);
       yTo(0);
       transXTo(0);
       transYTo(0);
       if (glowRef.current) gsap.to(glowRef.current, { opacity: 0, duration: 0.5 });
       gsap.to(inner, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
    };

    btn.addEventListener('mousemove', handleMouseMove);
    btn.addEventListener('mouseenter', handleMouseEnter);
    btn.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      btn.removeEventListener('mousemove', handleMouseMove);
      btn.removeEventListener('mouseenter', handleMouseEnter);
      btn.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <Link
      href={href}
      ref={btnRef}
      className={`relative inline-block overflow-visible cursor-pointer ${className}`}
      style={{ perspective: '800px' }}
    >
      <div 
        ref={innerRef}
        className="relative h-full w-full will-change-transform shadow-[0_10px_30px_-5px_rgba(8,126,139,0.4)] rounded-full bg-[#f4f6f3] border border-[#173640]/10"
        style={{ transformStyle: 'preserve-3d' }}
      >
         <div
          ref={glowRef}
          className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 rounded-full mix-blend-overlay"
        />
        <div style={{ transform: 'translateZ(20px)' }} className="flex h-full w-full items-center justify-center gap-3 px-10 py-5 text-lg font-extrabold text-[#173640]">
          {children}
        </div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  useIsomorphicLayoutEffect(() => {
    let ctx = gsap.context(() => {
      
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 2.2, 
        effects: true,
        normalizeScroll: true,
      });

      const scrubContainers = document.querySelectorAll('.scrub-title-container');
      scrubContainers.forEach((container) => {
        const words = container.querySelectorAll('.scrub-word');
        if (words.length > 0) {
          gsap.fromTo(words, 
            { opacity: 0.15 },
            {
              opacity: 1,
              stagger: 0.05,
              ease: 'none',
              scrollTrigger: {
                trigger: container,
                start: 'top 85%',
                end: 'bottom 40%',
                scrub: 1,
              },
            }
          );
        }
      });

      const fadeUps = document.querySelectorAll('.fade-up-anim');
      fadeUps.forEach((el) => {
        gsap.fromTo(el,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      });

      
    });

    return () => ctx.revert();
  }, []);

  return (
    <div id="smooth-wrapper" className="bg-[#f4f6f3]">
      <div id="smooth-content">
        <main className="min-h-screen w-full bg-[#f4f6f3] text-[#173640] selection:bg-[#087e8b] selection:text-white">
          
          {/* Hero Section */}
          <section className="relative w-full flex min-h-screen flex-col justify-end px-6 pb-12 pt-20 sm:px-14 lg:px-24 lg:pb-20 overflow-hidden">
            <div className="absolute inset-0 -z-10" data-speed="0.75">
              <Image
                src="/images/hero-vietnam.png"
                alt="Việt Nam lúc bình minh"
                fill
                priority
                className="object-cover opacity-40 grayscale-[10%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f4f6f3] via-[#f4f6f3]/50 to-transparent" />
            </div>

            {/* --- RIGHT SIDE DECORATIONS (BALLOONS & STAMP) --- */}
            <div className="absolute right-6 top-32 z-10 hidden w-64 lg:block xl:right-24 pointer-events-none">
              
              {/* Balloon 1 (Main) */}
              <div className="absolute right-0 top-0 animate-float-balloon pointer-events-auto">
                <svg width="80" height="110" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 5C25.147 5 5 25.147 5 50C5 74.853 35 110 50 110C65 110 95 74.853 95 50C95 25.147 74.853 5 50 5Z" fill="#c45438" />
                  <path d="M50 5C50 5 35 30 35 50C35 70 50 110 50 110" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3"/>
                  <path d="M50 5C50 5 65 30 65 50C65 70 50 110 50 110" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3"/>
                  <path d="M20 25C20 25 45 40 50 50C55 60 75 75 75 75" stroke="white" strokeWidth="2" opacity="0.1"/>
                  <line x1="42" y1="110" x2="40" y2="125" stroke="#5a403d" strokeWidth="2" />
                  <line x1="58" y1="110" x2="60" y2="125" stroke="#5a403d" strokeWidth="2" />
                  <rect x="36" y="125" width="28" height="15" rx="2" fill="#8B6653" />
                  <rect x="36" y="125" width="28" height="4" fill="#6B4B3A" />
                </svg>
              </div>

              {/* Balloon 2 (Small) */}
              <div className="absolute right-24 top-16 opacity-70 animate-drift-balloon pointer-events-auto">
                <svg width="50" height="70" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 5C25.147 5 5 25.147 5 50C5 74.853 35 110 50 110C65 110 95 74.853 95 50C95 25.147 74.853 5 50 5Z" fill="#087e8b" />
                  <path d="M50 5C50 5 35 30 35 50C35 70 50 110 50 110" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3"/>
                  <path d="M50 5C50 5 65 30 65 50C65 70 50 110 50 110" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.3"/>
                  <path d="M20 25C20 25 45 40 50 50C55 60 75 75 75 75" stroke="white" strokeWidth="2" opacity="0.1"/>
                  <line x1="42" y1="110" x2="40" y2="125" stroke="#5a403d" strokeWidth="2" />
                  <line x1="58" y1="110" x2="60" y2="125" stroke="#5a403d" strokeWidth="2" />
                  <rect x="36" y="125" width="28" height="15" rx="2" fill="#8B6653" />
                  <rect x="36" y="125" width="28" height="4" fill="#6B4B3A" />
                </svg>
              </div>

              {/* Stamp positioned right below Balloon 1 */}
              <Link href="/tours" className="hero-stamp liquid-btn group absolute right-[-1rem] top-40 flex size-[150px] cursor-pointer items-center justify-center rounded-full border border-[#173640]/30 bg-[#f4f6f3]/60 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-[#087e8b] pointer-events-auto">
                <div className="relative z-10 text-center text-[12px] font-extrabold uppercase leading-[1.6] tracking-[0.15em] text-[#173640] transition-colors duration-[600ms] group-hover:text-white">
                  Tìm tour<br />đúng với<br />cách bạn đi
                </div>
              </Link>

            </div>

            <div className="fade-up-anim flex items-center gap-2 mb-4">
              <span className="inline-block size-2.5 rounded-full bg-[#c45438] animate-pulse" />
              <p className="relative z-10 text-xs font-bold uppercase tracking-[0.24em] text-[#c45438]">
                Một cách khác để đi
              </p>
            </div>

            <div className="scrub-title-container relative z-10 max-w-6xl">
              <h1 className="text-[clamp(3.5rem,9vw,9.5rem)] font-extrabold leading-[0.84] tracking-[-0.06em] text-[#173640]">
                <ScrubWords text="Đi gần hơn. Sống sâu hơn." />
              </h1>
            </div>

            <div className="fade-up-anim relative z-10 mt-16 flex w-full flex-col gap-8 border-t border-[#173640]/25 pt-8">
              <div className="max-w-4xl">
                <p className="text-xl font-bold leading-8 text-[#173640] sm:text-2xl lg:whitespace-nowrap">
                  Tìm điểm đến. Chọn tour. Đặt chỗ. Thanh toán. Nhận e-ticket.
                </p>
                <p className="mt-3 text-base leading-7 text-[#49636b]">
                  TRIPRI gom cả hành trình vào một nơi rõ ràng — để bạn dành nhiều thời gian hơn cho trải nghiệm đang chờ phía trước.
                </p>
              </div>
            </div>
          </section>

          {/* Storytelling Section */}
          <section id="story" className="relative w-full px-6 pt-28 pb-12 sm:px-14 lg:px-24 lg:pt-40 lg:pb-16">
            <div className="grid gap-12 lg:grid-cols-[0.5fr_1.5fr] mb-24">
              <div className="fade-up-anim flex flex-col items-start relative h-full">
                <div className="sticky top-12">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#087e8b]">
                    Câu chuyện của TRIPRI
                  </p>
                  <div className="mt-8 relative overflow-hidden rounded-2xl w-32 h-32 md:w-48 md:h-48 border-[6px] border-white shadow-xl rotate-[-4deg] transition-transform hover:rotate-0 hover:scale-105 duration-300">
                    <Image src="/images/story-local-guide.png" alt="Câu chuyện TRIPRI" fill className="object-cover grayscale-[10%]" />
                  </div>
                </div>
              </div>
              <div className="scrub-title-container">
                <h2 className="text-4xl font-extrabold leading-[1.15] tracking-[-0.05em] text-[#173640] sm:text-5xl lg:text-7xl">
                  <ScrubWords text="Chúng tôi muốn việc đặt một chuyến đi trở nên đơn giản hơn." />
                </h2>
                <p className="fade-up-anim mt-10 max-w-3xl text-xl leading-relaxed text-[#49636b]">
                  Du lịch thường bắt đầu với quá nhiều tab, quá nhiều tin nhắn và những thông tin rời rạc. TRIPRI gom toàn bộ hành trình về một trải nghiệm liền mạch: khám phá điểm đến, tìm tour, so sánh lịch trình và đặt trực tuyến.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-20">
              {/* Vòng lặp lấy lại các nội dung Story Chapters */}
              {chapters.map((chapter, index) => (
                <article
                  key={chapter.number}
                  className="fade-up-anim grid min-h-[560px] items-center gap-12 border-t border-[#173640]/15 pt-20 pb-12 lg:grid-cols-[0.55fr_0.9fr_0.55fr]"
                >
                  <div className={`relative z-10 ${index % 2 ? 'lg:order-3' : ''}`}>
                    <span className="absolute -top-10 -left-4 sm:-top-16 sm:-left-8 text-[8rem] sm:text-[11rem] font-black text-white [-webkit-text-stroke:2px_#087e8b] opacity-50 select-none pointer-events-none z-[-1] leading-none">
                      {chapter.number}
                    </span>
                    <p className="relative z-10 mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#087e8b]">
                      {chapter.kicker}
                    </p>

                    <div className="scrub-title-container mt-4">
                      <h3 className="text-3xl font-extrabold leading-[1.02] tracking-[-0.06em] text-[#173640] sm:text-4xl lg:text-5xl">
                        <ScrubWords text={chapter.title} />
                      </h3>
                    </div>
                  </div>

                  <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-3xl bg-[#dbecef] shadow-xl">
                    <Image
                      src={chapter.image}
                      alt={chapter.kicker}
                      fill
                      className="object-cover grayscale-[15%] transition-transform duration-700 hover:scale-105 hover:grayscale-0"
                    />
                  </div>

                  <div className={`text-base leading-7 text-[#49636b] ${index % 2 ? 'lg:order-2' : ''}`}>
                    <p className="text-lg leading-8">{chapter.body}</p>
                    <p className="mt-6 italic font-semibold text-[#173640] border-l-4 border-[#087e8b] pl-4 text-base">
                      {chapter.side}
                    </p>
                  </div>
                </article>
              ))}

              {/* Chương cuối - Chỉ áp dụng 3D Tilt Parallax cho NÚT BẤM */}
              <article className="fade-up-anim grid items-center gap-12 border-t-2 border-[#087e8b] pt-24 pb-4 lg:grid-cols-[0.55fr_1.45fr]">
                <div className="relative z-10">
                  <span className="absolute -top-10 -left-4 sm:-top-16 sm:-left-8 text-[8rem] sm:text-[11rem] font-black text-white [-webkit-text-stroke:2px_#087e8b] opacity-50 select-none pointer-events-none z-[-1] leading-none">
                    05
                  </span>
                  <p className="relative z-10 mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#087e8b]">
                    Chương tiếp theo
                  </p>
                  <div className="scrub-title-container mt-4">
                    <h3 className="text-4xl font-extrabold leading-[0.94] tracking-[-0.06em] text-[#173640] sm:text-5xl lg:text-6xl">
                      <ScrubWords text="Một nơi mới đang chờ được kể." />
                    </h3>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#087e8b] via-[#0b6e7a] to-[#173640] p-12 sm:p-20 text-[#f4f6f3] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-12">
                  <div className="max-w-xl text-center md:text-left z-10">
                    <span className="inline-block rounded-full bg-[#b6edf2]/20 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#b6edf2] mb-6">
                      Sẵn sàng hành trình
                    </span>
                    <h4 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
                      Bắt đầu chuyến đi tiếp theo của bạn cùng TRIPRI
                    </h4>
                  </div>

                  <div className="shrink-0 z-10">
                    {/* CHỈ NÚT NÀY MỚI CÓ 3D TILT */}
                    <Tilt3DButton href="/home" className="group">
                      <span>Khám phá ngay</span>
                      <ArrowUpRight className="size-6 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </Tilt3DButton>
                  </div>

                  <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 size-[500px] rounded-full bg-[#b6edf2]/10 blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 size-[400px] rounded-full bg-[#173640]/40 blur-3xl pointer-events-none" />
                </div>
              </article>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
