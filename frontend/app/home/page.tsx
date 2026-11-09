'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGetTourDestinationsQuery, useGetToursQuery, AirbnbTourCarousel, HotVouchersSection, getRecentlyViewedTours, type TourListItem } from '@/features/tours';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectRole } from '@/features/auth';
import { GuestLoginPromptModal } from '@/components/shared';
import { Container } from '@/components/layout';

interface Slide {
  badge: string;
  badgeIcon: string;
  title: string;
  subtitle: string;
  location: string;
  image: string;
}

const HERO_SLIDES: Slide[] = [
  {
    badge: 'Kỳ quan thế giới UNESCO',
    badgeIcon: 'travel_explore',
    title: 'Chạm Bản Sắc Việt — Hành Trình Độc Bản Theo Phong Cách Riêng',
    subtitle: 'Trải nghiệm du lịch bản địa trọn vẹn với lộ trình cá nhân hóa, đối tác tuyển chọn và giá niêm yết minh bạch.',
    location: 'Vịnh Hạ Long & Lan Hạ, Quảng Ninh',
    image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=2400&q=85',
  },
  {
    badge: 'Di sản văn hóa & thiên nhiên',
    badgeIcon: 'landscape',
    title: 'Tuyệt Tác Non Nước Ninh Bình',
    subtitle: 'Lững lờ trôi thuyền giữa dòng sông Sao Khê xanh mát, xuyên qua những hang động huyền bí nguyên sơ.',
    location: 'Tràng An, Ninh Bình',
    image: 'https://images.unsplash.com/photo-1574950578143-858c6fc58922?auto=format&fit=crop&w=2400&q=85',
  },
  {
    badge: 'Đô thị cổ quyến rũ',
    badgeIcon: 'flare',
    title: 'Đêm Hoài Phố Đèn Lồng Lung Linh',
    subtitle: 'Dạo bước giữa những bức tường vàng rêu phong và nghe nhịp chèo khua bóng nước sông Hoài bình yên.',
    location: 'Phố Cổ Hội An, Quảng Nam',
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=2400&q=85',
  },
  {
    badge: 'Thiên đường biển đảo',
    badgeIcon: 'beach_access',
    title: 'Hoàng Hôn Đảo Ngọc Phú Quốc',
    subtitle: 'Thả mình giữa làn nước ngọc bích, ngắm hoàng hôn rực rỡ và thưởng thức hải sản tươi ngon đậm vị biển.',
    location: 'Phú Quốc, Kiên Giang',
    image: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=2400&q=85',
  },
];

function CalendarOutlineIcon({ className = "text-slate-500" }: { className?: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" className={className}>
      <line x1="10" y1="3" x2="10" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="3" x2="22" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="5" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="5" y1="11" x2="27" y2="11" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarFoldedIcon({ className = "text-slate-900" }: { className?: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" className={className}>
      <line x1="10" y1="3" x2="10" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="3" x2="22" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path 
        d="M 18 27 H 10 C 7.2 27 5 24.8 5 22 V 10 C 5 7.2 7.2 5 10 5 H 22 C 24.8 5 27 7.2 27 10 V 18 L 18 27 Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinejoin="round" 
      />
      <line x1="5" y1="11" x2="27" y2="11" stroke="currentColor" strokeWidth="2" />
      <path 
        d="M 18 27 V 20 C 18 19 19 18 20 18 H 27" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getCalendarMonth(year: number, month: number) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const leadingOffset = (firstDay + 6) % 7; // Monday = 0, ..., Sunday = 6

  const days: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    days.push(new Date(year, month, d));
  }

  return {
    year,
    month,
    totalDays,
    leadingOffset,
    days,
  };
}

function getDynamicFlexibleMonths() {
  const current = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(current.getFullYear(), current.getMonth() + i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    months.push({
      id: `${m}-${y}`,
      month: `Tháng ${m}`,
      year: `${y}`,
      short: `thg ${m}`,
    });
  }
  return months;
}

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectRole);

  useEffect(() => {
    if (role === 'AGENCY') {
      router.replace('/agency');
    }
  }, [role, router]);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [selectedTourPrompt, setSelectedTourPrompt] = useState<{ title?: string; href?: string }>({});

  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchSticky, setIsSearchSticky] = useState(false);

  // Real tours from database for favorites and recent
  const { data: favoritesRes, isLoading: isLoadingFavorites } = useGetToursQuery({
    sort: 'rating',
    minRating: 4.5,
    limit: 12,
  });
  const { data: recentRes, isLoading: isLoadingRecent } = useGetToursQuery({
    sort: 'newest',
    limit: 12,
  });
  const favoriteTours = favoritesRes?.items || [];
  const recentTours = recentRes?.items || [];

  // Recently viewed tours from localStorage
  const [viewedTours, setViewedTours] = useState<TourListItem[]>([]);
  useEffect(() => {
    setViewedTours(getRecentlyViewedTours());
  }, []);

  const flexibleMonths = useMemo(() => getDynamicFlexibleMonths(), []);

  // Today normalized to midnight
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // Search Dropdown States
  const [activeDropdown, setActiveDropdown] = useState<'location' | 'date' | 'guests' | null>(null);
  const [hoveredField, setHoveredField] = useState<'location' | 'date' | 'guests' | null>(null);
  const [dateMode, setDateMode] = useState<'exact' | 'flexible'>('exact');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [flexibleDuration, setFlexibleDuration] = useState<'weekend' | 'week' | 'month' | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const monthsScrollRef = useRef<HTMLDivElement>(null);
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);

  const tourSearchHref = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('destination', searchQuery.trim());
    if (startDate) {
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      params.set('departureFrom', fmt(startDate));
      if (endDate) params.set('departureTo', fmt(endDate));
    }
    const totalGuests = adults + children;
    if (totalGuests > 0) params.set('guests', String(totalGuests));
    const qs = params.toString();
    return qs ? `/tours?${qs}` : '/tours';
  }, [searchQuery, startDate, endDate, adults, children]);

  // Fetch real destinations directly from database via backend API
  const { data: databaseDestinations = [] } = useGetTourDestinationsQuery();

  // Filter dynamically based on search query
  const suggestedDestinations = useMemo(() => {
    if (!searchQuery.trim()) return databaseDestinations;
    const q = searchQuery.toLowerCase().trim();
    return databaseDestinations.filter(
      (item) =>
        item.destination.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [databaseDestinations, searchQuery]);

  // Auto-play Hero Carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    
    const handleScroll = () => {
      const searchConsole = document.getElementById('search-console');
      if (searchConsole) {
        const rect = searchConsole.getBoundingClientRect();
        // Chỉ hiện thanh tìm kiếm mini khi người dùng đã cuộn qua hết toàn bộ thanh search chính
        setIsSearchSticky(rect.bottom <= 0);
      } else {
        setIsSearchSticky(window.scrollY > 650);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const slide = HERO_SLIDES[currentSlide];

  const getExactDateText = () => {
    if (!startDate) return '';
    const startDay = startDate.getDate();
    const startMonth = startDate.getMonth() + 1;
    const startYear = startDate.getFullYear();

    if (!endDate || (startDate.getTime() === endDate.getTime())) {
      return `${startDay} thg ${startMonth}`;
    }

    const endDay = endDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endYear = endDate.getFullYear();

    if (startYear === endYear) {
      return `${startDay} thg ${startMonth} - ${endDay} thg ${endMonth}`;
    }
    return `${startDay} thg ${startMonth}, ${startYear} - ${endDay} thg ${endMonth}, ${endYear}`;
  };

  const getFlexibleDateText = () => {
    const durationLabel = 
      flexibleDuration === 'weekend' ? 'Cuối tuần' :
      flexibleDuration === 'week' ? '1 tuần' :
      flexibleDuration === 'month' ? '1 tháng' : '';

    const sortedSelected = flexibleMonths.filter(m => selectedMonths.includes(m.id));
    const monthsLabel = sortedSelected.length > 0
      ? sortedSelected.map(m => m.short).join(', ')
      : '';

    if (durationLabel && monthsLabel) {
      return `${durationLabel} trong ${monthsLabel}`;
    }
    if (durationLabel) {
      return `${durationLabel}`;
    }
    if (monthsLabel) {
      return sortedSelected.map(m => m.month).join(', ');
    }
    return '';
  };

  const displayDateText = dateMode === 'exact' ? getExactDateText() : getFlexibleDateText();
  const datePlaceholder = displayDateText || (dateMode === 'flexible' ? 'Thời gian bất kỳ' : 'Thêm ngày');
  const hasDateValue = Boolean(
    dateMode === 'exact' 
      ? Boolean(startDate) 
      : (flexibleDuration || selectedMonths.length > 0)
  );

  const handleDayClick = (dayDate: Date) => {
    const dayClean = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    if (dayClean.getTime() < today.getTime()) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(dayClean);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (dayClean.getTime() < startDate.getTime()) {
        setStartDate(dayClean);
        setEndDate(null);
      } else {
        setEndDate(dayClean);
      }
    }
  };

  const toggleMonth = (monthId: string) => {
    setSelectedMonths(prev => 
      prev.includes(monthId) 
        ? prev.filter(id => id !== monthId)
        : [...prev, monthId]
    );
  };

  const selectDuration = (duration: 'weekend' | 'week' | 'month') => {
    setFlexibleDuration(prev => prev === duration ? null : duration);
  };

  const scrollMonths = (direction: 'left' | 'right') => {
    if (monthsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      monthsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const month1Base = useMemo(() => new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1), [today, calendarMonthOffset]);
  const month2Base = useMemo(() => new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset + 1, 1), [today, calendarMonthOffset]);
  const month1Data = useMemo(() => getCalendarMonth(month1Base.getFullYear(), month1Base.getMonth()), [month1Base]);
  const month2Data = useMemo(() => getCalendarMonth(month2Base.getFullYear(), month2Base.getMonth()), [month2Base]);

  const renderDayCell = (d: Date, totalDaysInMonth: number) => {
    const dClean = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const isPast = dClean.getTime() < today.getTime();

    const isStart = Boolean(startDate && isSameDay(dClean, startDate));
    const effectiveEnd = endDate || (startDate && hoverDate && hoverDate.getTime() >= startDate.getTime() ? hoverDate : null);
    const isEnd = Boolean(effectiveEnd && isSameDay(dClean, effectiveEnd));
    const hasRange = Boolean(startDate && effectiveEnd && startDate.getTime() !== effectiveEnd.getTime());

    const inRange = Boolean(
      startDate &&
      effectiveEnd &&
      dClean.getTime() > startDate.getTime() &&
      dClean.getTime() < effectiveEnd.getTime()
    );

    const dayOfWeekIndex = (d.getDay() + 6) % 7; // 0 for Mon (T2), 6 for Sun (CN)
    const isStartOfRow = dayOfWeekIndex === 0;
    const isEndOfRow = dayOfWeekIndex === 6;
    const isFirstOfMonth = d.getDate() === 1;
    const isLastOfMonth = d.getDate() === totalDaysInMonth;

    return (
      <div
        key={d.toISOString()}
        id={`day-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`}
        data-day={d.getDate()}
        data-month={d.getMonth() + 1}
        data-year={d.getFullYear()}
        className={`relative h-10 md:h-11 flex items-center justify-center ${isPast ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onMouseEnter={() => {
          if (!isPast && startDate && !endDate) {
            setHoverDate(dClean);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isPast) handleDayClick(dClean);
        }}
      >
        {/* Intermediate days continuous background */}
        {inRange && (
          <div
            className={`absolute inset-y-0 inset-x-0 bg-slate-300 pointer-events-none ${
              isStartOfRow || isFirstOfMonth ? 'rounded-l-full' : ''
            } ${
              isEndOfRow || isLastOfMonth ? 'rounded-r-full' : ''
            }`}
          />
        )}

        {/* Start date right half background connector */}
        {isStart && hasRange && (
          <div
            className={`absolute inset-y-0 right-0 w-1/2 bg-slate-300 pointer-events-none ${
              isEndOfRow || isLastOfMonth ? 'rounded-r-full' : ''
            }`}
          />
        )}

        {/* End date left half background connector */}
        {isEnd && hasRange && (
          <div
            className={`absolute inset-y-0 left-0 w-1/2 bg-slate-300 pointer-events-none ${
              isStartOfRow || isFirstOfMonth ? 'rounded-l-full' : ''
            }`}
          />
        )}

        {/* Date circle */}
        <div
          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all select-none ${
            isStart || isEnd
              ? 'bg-slate-900 text-white font-bold shadow-sm'
              : isPast
              ? 'text-slate-300 cursor-not-allowed'
              : inRange
              ? 'text-slate-900 font-bold'
              : 'text-slate-800 hover:border hover:border-slate-800'
          }`}
        >
          {d.getDate()}
        </div>
      </div>
    );
  };

  const hideDivider1 = hoveredField === 'location' || hoveredField === 'date' || activeDropdown === 'location' || activeDropdown === 'date';
  const hideDivider2 = hoveredField === 'date' || hoveredField === 'guests' || activeDropdown === 'date' || activeDropdown === 'guests';

  return (
    <>
      <div className="flex flex-col w-full -mt-20">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION WITH BACKGROUND CAROUSEL & SEARCH CONSOLE                 */}
        {/* ========================================================================= */}
        <section className="relative w-full min-h-[640px] lg:min-h-[720px] overflow-visible bg-white flex flex-col justify-between">
          {/* Background slides container: reaches down only to the horizontal midline of the search bar */}
          <div className="absolute inset-x-0 top-0 bottom-[120px] md:bottom-[39px] overflow-hidden bg-[#0d1d26] pointer-events-none">
            {HERO_SLIDES.map((item, index) => {
              const isActive = index === currentSlide;
              return (
                <div
                  key={item.location}
                  className={`absolute inset-0 w-full h-full ${
                    isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  {/* Background Image with Ambient Filter */}
                  <div
                    className={`absolute inset-0 bg-cover bg-center transition-transform duration-[6000ms] ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                    style={{
                      backgroundImage: `url("${item.image}")`,
                      filter: 'brightness(0.85) saturate(1.1) contrast(1.02)',
                    }}
                  />

                  {/* Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1d26] via-[#0d1d26]/40 to-black/30" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#004f57]/50 via-transparent to-transparent" />

                  {/* Smooth bottom fade out across the midline of the search bar so the image looks cut / cleanly faded out */}
                  <div className="absolute inset-x-0 bottom-0 h-32 sm:h-44 bg-gradient-to-b from-transparent via-[#0d1d26]/40 to-white pointer-events-none" />
                </div>
              );
            })}
          </div>

          {/* Hero Content (Top / Center) */}
          <Container className="relative z-10 flex min-h-[600px] flex-1 flex-col pt-28 pb-16 text-white md:min-h-[562px] md:pb-20 lg:min-h-[642px] lg:pt-36">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md w-fit mb-4 text-secondary-fixed border border-white/20 shadow-sm">
              <span className="material-symbols-outlined text-[16px]">{slide.badgeIcon}</span>
              <span className="text-xs uppercase font-bold tracking-wider">{slide.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold max-w-3xl mb-4 leading-tight drop-shadow-md">
              {slide.title}
            </h1>

            <p className="text-base sm:text-lg text-surface-container-low max-w-xl mb-6 drop-shadow leading-relaxed">
              {slide.subtitle}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-4">
              <Link
                href="/tours"
                className="inline-flex items-center justify-center gap-2 bg-[#087e8b] hover:bg-[#00636e] text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-2xl shadow-xl shadow-primary-container/30 transition-all transform hover:-translate-y-0.5 border border-white/20 h-12"
              >
                <span>Khám phá ngay</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>

              <span className="text-xs sm:text-sm text-surface-variant flex items-center gap-1.5 backdrop-blur-md px-3.5 py-2 rounded-xl bg-slate-900/40 border border-white/10 shadow-sm h-12">
                <span className="material-symbols-outlined text-[16px] text-secondary-fixed">photo_camera</span>
                {slide.location}
              </span>
            </div>
          </Container>

          {/* Carousel navigation */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between px-3 sm:px-5 lg:px-8">
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
              aria-label="Slide trước"
              className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-white/30 bg-slate-950/25 text-white backdrop-blur-md transition-colors hover:bg-slate-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
              aria-label="Slide tiếp theo"
              className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-white/30 bg-slate-950/25 text-white backdrop-blur-md transition-colors hover:bg-slate-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">chevron_right</span>
            </button>
          </div>

          {/* SEARCH CONSOLE SITS AT THE BOTTOM, EXACTLY BRIDGING HALF OVER THE HERO IMAGE AND HALF ON WHITE BACKGROUND */}
          <div className="relative z-30 pb-0 px-4 w-full">
            <Container as="div" id="search-console" className="max-w-4xl mx-auto">
              {activeDropdown && (
                <div 
                  className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity" 
                  onClick={() => setActiveDropdown(null)} 
                />
              )}
              <div 
                onMouseLeave={() => setHoveredField(null)}
                className={`flex flex-col md:flex-row items-stretch h-auto md:h-[78px] bg-white rounded-3xl md:rounded-full border border-white/90 shadow-[0_16px_36px_rgba(0,0,0,0.22)] relative gap-2 md:gap-0 transition-colors z-40 p-2 md:p-0 ${
                  activeDropdown ? 'md:bg-slate-100/95' : 'md:bg-white'
                }`}
              >
                {/* Field 1: Destination / Route */}
                <div 
                  className={`relative flex-1 w-full h-auto md:h-full p-3.5 md:py-0 md:px-8 rounded-2xl md:rounded-full transition-all cursor-pointer group flex flex-col justify-center ${
                    activeDropdown === 'location' 
                      ? 'bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] z-50 md:rounded-full border border-slate-200 md:border-transparent' 
                      : hoveredField === 'location'
                      ? 'bg-slate-200/80 md:bg-slate-200/80'
                      : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200/80 md:hover:bg-slate-200/80'
                  }`}
                  onMouseEnter={() => setHoveredField('location')}
                  onClick={() => setActiveDropdown('location')}
                >
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-0.5 cursor-pointer">
                    Địa điểm
                  </label>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm điểm đến"
                      className="w-full bg-transparent text-sm md:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none cursor-pointer truncate"
                    />
                    {activeDropdown === 'location' && searchQuery && (
                      <button 
                        type="button" 
                        title="Xóa điểm đến"
                        aria-label="Xóa điểm đến"
                        onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all ml-2 flex-shrink-0 shadow-xs hover:scale-105 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                  {/* Location Popup */}
                  {activeDropdown === 'location' && (
                    <div className="absolute top-[calc(100%+14px)] left-0 w-[calc(100vw-32px)] sm:w-[480px] md:w-[520px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 z-[100] cursor-default" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Điểm đến theo tour du lịch
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {suggestedDestinations.length} điểm đến gợi ý
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto pr-1">
                        {suggestedDestinations.length === 0 ? (
                          <div className="py-8 text-center text-sm text-slate-400 font-medium">
                            Không tìm thấy điểm đến phù hợp với &quot;{searchQuery}&quot;
                          </div>
                        ) : (
                          suggestedDestinations.map(item => (
                            <div 
                              key={item.destination} 
                              className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-100" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSearchQuery(item.destination); 
                                setActiveDropdown('date'); 
                              }}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-11 h-11 flex-shrink-0 rounded-2xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105 ${item.iconBgClass || 'bg-slate-100 text-slate-700'}`}>
                                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors truncate">
                                    {item.destination}
                                  </div>
                                  <div className="text-xs text-slate-500 truncate max-w-[280px] sm:max-w-[340px]">
                                    {item.description}
                                  </div>
                                </div>
                              </div>
                              {item.count > 0 && (
                                <span className="ml-2 flex-shrink-0 text-[11px] font-bold text-[#087E8B] bg-[#087E8B]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                                  {item.count} tour
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider 1 */}
                <div 
                  className={`hidden md:block w-px h-8 bg-slate-200 self-center flex-shrink-0 pointer-events-none transition-opacity duration-150 ${
                    hideDivider1 ? 'opacity-0' : 'opacity-100'
                  }`}
                />

                {/* Field 2: Date Selector */}
                <div 
                  className={`relative flex-1 w-full h-auto md:h-full p-3.5 md:py-0 md:px-8 rounded-2xl md:rounded-full transition-all cursor-pointer group flex flex-col justify-center ${
                    activeDropdown === 'date' 
                      ? 'bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] z-50 md:rounded-full border border-slate-200 md:border-transparent' 
                      : hoveredField === 'date'
                      ? 'bg-slate-200/80 md:bg-slate-200/80'
                      : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200/80 md:hover:bg-slate-200/80'
                  }`}
                  onMouseEnter={() => setHoveredField('date')}
                  onClick={() => setActiveDropdown('date')}
                >
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-0.5 cursor-pointer">
                    Thời gian
                  </label>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      readOnly
                      value={displayDateText}
                      placeholder={datePlaceholder}
                      className="w-full bg-transparent text-sm md:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none cursor-pointer truncate"
                    />
                    {activeDropdown === 'date' && hasDateValue && (
                      <button 
                        type="button" 
                        title="Xóa thời gian"
                        aria-label="Xóa thời gian"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setStartDate(null);
                          setEndDate(null);
                          setHoverDate(null);
                          setFlexibleDuration(null);
                          setSelectedMonths([]);
                        }}
                        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all ml-2 flex-shrink-0 shadow-xs hover:scale-105 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                  {/* Date Popup */}
                  {activeDropdown === 'date' && (
                    <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] sm:w-[720px] md:w-[760px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 z-[100] cursor-default" onClick={e => e.stopPropagation()}>
                       {/* Header Switcher: Ngày vs Linh hoạt */}
                       <div className="flex justify-center mb-6">
                         <div className="bg-slate-100 p-1.5 rounded-full flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setDateMode('exact');
                             }}
                             className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                               dateMode === 'exact' 
                                 ? 'bg-white text-slate-900 shadow-md' 
                                 : 'text-slate-600 hover:text-slate-900'
                             }`}
                           >
                             Ngày
                           </button>
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setDateMode('flexible');
                             }}
                             className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                               dateMode === 'flexible' 
                                 ? 'bg-white text-slate-900 shadow-md' 
                                 : 'text-slate-600 hover:text-slate-900'
                             }`}
                           >
                             Linh hoạt
                           </button>
                         </div>
                       </div>

                       {dateMode === 'exact' ? (
                         /* EXACT CALENDAR VIEW (REAL DYNAMIC CALENDAR) */
                         <div onMouseLeave={() => setHoverDate(null)}>
                           {/* Navigation & Month Titles */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-4">
                             {/* Month 1 Header */}
                             <div className="flex items-center justify-between">
                               <button
                                 type="button"
                                 disabled={calendarMonthOffset <= 0}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setCalendarMonthOffset((prev) => Math.max(0, prev - 1));
                                 }}
                                 aria-label="Tháng trước"
                                 className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                   calendarMonthOffset <= 0
                                     ? 'text-slate-200 cursor-not-allowed opacity-40'
                                     : 'text-slate-800 hover:bg-slate-100 cursor-pointer'
                                 }`}
                               >
                                 <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                               </button>
                               <div className="font-bold text-slate-900 text-base">
                                 {`Tháng ${month1Data.month + 1} năm ${month1Data.year}`}
                               </div>
                               {/* Mobile Next Month Button */}
                               <div className="block md:hidden">
                                 <button
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setCalendarMonthOffset((prev) => prev + 1);
                                   }}
                                   aria-label="Tháng sau"
                                   className="w-8 h-8 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 cursor-pointer"
                                 >
                                   <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                 </button>
                               </div>
                               <div className="hidden md:block w-8 h-8" />
                             </div>

                             {/* Month 2 Header (Desktop) */}
                             <div className="hidden md:flex items-center justify-between">
                               <div className="w-8 h-8" />
                               <div className="font-bold text-slate-900 text-base">
                                 {`Tháng ${month2Data.month + 1} năm ${month2Data.year}`}
                               </div>
                               <button
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setCalendarMonthOffset((prev) => prev + 1);
                                 }}
                                 aria-label="Tháng sau"
                                 className="w-8 h-8 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                               >
                                 <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                               </button>
                             </div>
                           </div>

                           {/* Months Grid */}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                             {/* Month 1 */}
                             <div>
                               <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2 py-1">
                                 <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                               </div>
                               <div className="grid grid-cols-7 text-center text-sm font-semibold gap-y-1">
                                 {Array.from({ length: month1Data.leadingOffset }).map((_, idx) => (
                                   <div key={`m1-empty-${idx}`} className="h-10 md:h-11" />
                                 ))}
                                 {month1Data.days.map((d) => renderDayCell(d, month1Data.totalDays))}
                                </div>
                             </div>

                             {/* Month 2 */}
                             <div className="hidden md:block">
                               <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2 py-1">
                                 <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                               </div>
                               <div className="grid grid-cols-7 text-center text-sm font-semibold gap-y-1">
                                 {Array.from({ length: month2Data.leadingOffset }).map((_, idx) => (
                                   <div key={`m2-empty-${idx}`} className="h-10 md:h-11" />
                                 ))}
                                 {month2Data.days.map((d) => renderDayCell(d, month2Data.totalDays))}
                                </div>
                             </div>
                           </div>
                         </div>
                       ) : (
                         /* FLEXIBLE VIEW */
                         <div className="flex flex-col items-center pt-2" onClick={(e) => e.stopPropagation()}>
                           {/* Section 1: Bạn muốn ở trong bao lâu? */}
                           <h3 className="font-bold text-slate-900 text-base md:text-lg mb-4 text-center">
                             Bạn muốn ở trong bao lâu?
                           </h3>
                           <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
                             {[
                               { key: 'weekend', label: 'Cuối tuần' },
                               { key: 'week', label: '1 tuần' },
                               { key: 'month', label: '1 tháng' },
                             ].map((dur) => {
                               const isSelected = flexibleDuration === dur.key;
                               return (
                                 <button
                                   key={dur.key}
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     selectDuration(dur.key as 'weekend' | 'week' | 'month');
                                   }}
                                   className={`px-7 py-2.5 rounded-full text-sm transition-all cursor-pointer ${
                                     isSelected
                                       ? 'border-2 border-slate-900 bg-slate-900 text-white font-bold shadow-sm'
                                       : 'border border-slate-300 hover:border-slate-800 text-slate-700 font-medium bg-white'
                                   }`}
                                 >
                                   {dur.label}
                                 </button>
                               );
                             })}
                           </div>

                           {/* Section 2: Bạn muốn đi khi nào? */}
                           <h3 className="font-bold text-slate-900 text-base md:text-lg mb-4 text-center">
                             Bạn muốn đi khi nào?
                           </h3>
                           <div className="relative w-full max-w-[680px]">
                             {/* Scrollable Month Cards */}
                             <div 
                               ref={monthsScrollRef}
                               className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
                               style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                             >
                               {flexibleMonths.map((item) => {
                                 const isSelected = selectedMonths.includes(item.id);
                                 return (
                                   <button
                                     key={item.id}
                                     type="button"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       toggleMonth(item.id);
                                     }}
                                     className={`w-[110px] md:w-[120px] h-[126px] md:h-[134px] rounded-3xl p-3 flex flex-col items-center justify-center shrink-0 transition-all cursor-pointer ${
                                       isSelected
                                         ? 'border-2 border-slate-900 bg-slate-50/90 shadow-sm'
                                         : 'border border-slate-200 bg-white hover:border-slate-400'
                                     }`}
                                   >
                                     {isSelected ? (
                                       <CalendarFoldedIcon className="text-slate-900 mb-2" />
                                     ) : (
                                       <CalendarOutlineIcon className="text-slate-500 mb-2" />
                                     )}
                                     <div className={`text-sm leading-tight ${isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                       {item.month}
                                     </div>
                                     <div className="text-xs text-slate-400 mt-0.5">
                                       {item.year}
                                     </div>
                                   </button>
                                 );
                               })}
                             </div>

                             {/* Left Navigation Button */}
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 scrollMonths('left');
                               }}
                               aria-label="Cuộn sang trái"
                               className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-900 hover:scale-105 transition-all z-10 cursor-pointer"
                             >
                               <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                             </button>

                             {/* Right Navigation Button */}
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 scrollMonths('right');
                               }}
                               aria-label="Cuộn sang phải"
                               className="absolute -right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-900 hover:scale-105 transition-all z-10 cursor-pointer"
                             >
                               <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                  )}
                </div>

                {/* Divider 2 */}
                <div 
                  className={`hidden md:block w-px h-8 bg-slate-200 self-center flex-shrink-0 pointer-events-none transition-opacity duration-150 ${
                    hideDivider2 ? 'opacity-0' : 'opacity-100'
                  }`}
                />

                {/* Field 3: Guest Selector */}
                <div 
                  className={`relative flex-[1.3] w-full h-auto md:h-full p-3.5 md:py-0 md:pl-7 md:pr-2.5 rounded-2xl md:rounded-full transition-all cursor-pointer group flex items-center justify-between ${
                    activeDropdown === 'guests' 
                      ? 'bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] z-50 md:rounded-full border border-slate-200 md:border-transparent' 
                      : hoveredField === 'guests'
                      ? 'bg-slate-200/80 md:bg-slate-200/80'
                      : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200/80 md:hover:bg-slate-200/80'
                  }`}
                  onMouseEnter={() => setHoveredField('guests')}
                  onClick={() => setActiveDropdown('guests')}
                >
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-0.5 cursor-pointer">
                      Khách
                    </label>
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        readOnly
                        value={adults + children > 0 ? `${adults + children} khách${infants > 0 ? `, ${infants} em bé` : ''}${pets > 0 ? `, ${pets} thú cưng` : ''}` : ''}
                        placeholder="Thêm khách"
                        className="w-full bg-transparent text-sm md:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none cursor-pointer truncate"
                      />
                      {activeDropdown === 'guests' && (adults + children + infants + pets > 0) && (
                        <button 
                          type="button" 
                          title="Xóa khách"
                          aria-label="Xóa khách"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setAdults(0);
                            setChildren(0);
                            setInfants(0);
                            setPets(0);
                          }}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all ml-2 flex-shrink-0 shadow-xs hover:scale-105 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[16px] sm:text-[18px]">close</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Button for Desktop (TO, TRÒN RA, NẰM GỌN TRÊN MÉP PHẢI) */}
                  <div className="hidden md:flex items-center ml-3 flex-shrink-0">
                    <Link
                      href={tourSearchHref}
                      onClick={(e) => e.stopPropagation()}
                      className="size-14 bg-[#087e8b] hover:bg-[#00636e] text-white rounded-full flex items-center justify-center transition-transform transform hover:scale-105 shadow-md"
                    >
                      <span className="material-symbols-outlined text-[26px]">search</span>
                    </Link>
                  </div>
                  {/* Guests Popup */}
                  {activeDropdown === 'guests' && (
                    <div className="absolute top-[calc(100%+14px)] right-0 w-[calc(100vw-32px)] sm:w-[350px] bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-[100] cursor-default" onClick={e => e.stopPropagation()}>
                       <div className="flex flex-col gap-6 divide-y divide-slate-100">
                          <div className="flex items-center justify-between pt-2">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Người lớn</div>
                               <div className="text-xs text-slate-500">Từ 13 tuổi trở lên</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setAdults(Math.max(0, adults - 1)); }}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{adults}</span>
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setAdults(adults + 1); }}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Trẻ em</div>
                               <div className="text-xs text-slate-500">Độ tuổi 2 – 12</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setChildren(Math.max(0, children - 1)); }}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{children}</span>
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setChildren(children + 1); }}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Em bé</div>
                               <div className="text-xs text-slate-500">Dưới 2 tuổi</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setInfants(Math.max(0, infants - 1)); }}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{infants}</span>
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setInfants(infants + 1); }}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Thú cưng</div>
                               <div className="text-xs text-slate-500 underline cursor-pointer hover:text-slate-800">Bạn sẽ mang theo động vật phục vụ?</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setPets(Math.max(0, pets - 1)); }}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{pets}</span>
                               <button type="button" className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={(e) => { e.stopPropagation(); setPets(pets + 1); }}>+</button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>

                {/* Mobile Search Button */}
                <div className="md:hidden mt-2 w-full">
                  <Link
                    href={tourSearchHref}
                    className="w-full min-h-[56px] bg-[#087e8b] hover:bg-[#00636e] text-white text-base font-bold rounded-2xl shadow-lg shadow-[#087e8b]/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                  >
                    <span className="material-symbols-outlined text-[22px]">search</span>
                    <span>Tìm kiếm</span>
                  </Link>
                </div>
              </div>
            </Container>
          </div>
        </section>

        {/* Floating Mini Search Console in Header */}
        <div className={`fixed top-4 lg:top-3 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full ${
          isSearchSticky ? "translate-y-0 opacity-100 pointer-events-auto scale-100" : "-translate-y-10 opacity-0 pointer-events-none scale-95"
        }`}>
          <div className="flex items-center bg-white rounded-full border border-slate-200 p-1.5 pl-5 h-[52px]">
             <div className="flex items-center divide-x divide-slate-200 text-sm font-semibold text-slate-800">
               <button 
                 type="button" 
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('location'); }}
                 className="pr-4 hover:text-primary transition-colors truncate max-w-[150px]"
               >
                 {searchQuery || 'Mọi nơi'}
               </button>
               <button 
                 type="button"
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('date'); }}
                 className="px-4 hover:text-primary transition-colors whitespace-nowrap"
               >
                 {displayDateText || 'Bất kỳ lúc nào'}
               </button>
               <button 
                 type="button"
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('guests'); }}
                 className="px-4 hover:text-primary transition-colors whitespace-nowrap text-slate-500 font-normal"
               >
                 {adults + children > 0 ? `${adults + children} khách` : 'Thêm khách'}
               </button>
             </div>
             <button 
               type="button"
               onClick={() => document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
               className="w-10 h-10 ml-1 rounded-full bg-[#087e8b] hover:bg-[#00636e] text-white flex items-center justify-center transition-colors shadow-md"
             >
               <span className="material-symbols-outlined text-[18px]">search</span>
             </button>
          </div>
        </div>

        <div className="flex flex-col gap-12 sm:gap-16 pt-12 sm:pt-16 pb-16">
          {/* ========================================================================= */}
          {/* 2. CÁC TOUR BẠN ĐÃ XEM                                                   */}
          {/* ========================================================================= */}
          {viewedTours.length > 5 && (
            <Container as="section">
              <AirbnbTourCarousel
                title="Các tour bạn đã xem"
                badgeText="Đã xem gần đây"
                viewAllHref="/tours"
                tours={viewedTours}
              />
            </Container>
          )}

          {/* ========================================================================= */}
          {/* 3. VOUCHER HOT (REAL TIME TỪ DATABASE)                                    */}
          {/* ========================================================================= */}
          <Container as="section">
            <HotVouchersSection />
          </Container>

          {/* ========================================================================= */}
          {/* 4. CÁC TOUR ĐƯỢC KHÁCH YÊU THÍCH (SAO > 4.5)                             */}
          {/* ========================================================================= */}
          <Container as="section">
            <AirbnbTourCarousel
              title="Các tour được khách yêu thích"
              badgeText="Được khách yêu thích"
              viewAllHref="/tours?sort=rating"
              tours={favoriteTours}
              isLoading={isLoadingFavorites}
            />
          </Container>

          {/* ========================================================================= */}
          {/* 5. CÁC TOUR ĐƯỢC THÊM GẦN ĐÂY (MỚI NHẤT)                                  */}
          {/* ========================================================================= */}
          <Container as="section">
            <AirbnbTourCarousel
              title="Các tour được thêm gần đây"
              badgeText="Mới ra mắt"
              viewAllHref="/tours?sort=newest"
              tours={recentTours}
              isLoading={isLoadingRecent}
            />
          </Container>

          {/* ========================================================================= */}
          {/* 5. TRUST & CORE VALUES                                                    */}
          {/* ========================================================================= */}
          <Container as="section">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-container block mb-2">
                Giá trị cốt lõi
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
                An Tâm Trọn Vẹn Khi Đặt Chỗ Tại Tripri
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: 'verified_user',
                  title: 'Đối tác kiểm định',
                },
                {
                  icon: 'payments',
                  title: 'Minh bạch chi phí',
                },
                {
                  icon: 'published_with_changes',
                  title: 'Chính sách hủy linh hoạt',
                },
                {
                  icon: 'support_agent',
                  title: 'Đồng hành 24/7',
                },
              ].map((val) => (
                <div
                  key={val.title}
                  className="rounded-2xl bg-white shadow-[0_8px_25px_-5px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all p-6"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                    <span className="material-symbols-outlined text-[28px]">{val.icon}</span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{val.title}</h3>
                </div>
              ))}
            </div>
          </Container>

          {/* ========================================================================= */}
          {/* 6. PARTNER CALLOUT BANNER                                                 */}
          {/* ========================================================================= */}
          <Container as="section">
            <div className="rounded-3xl shadow-xl border border-surface-container bg-gradient-to-r from-surface-container-high to-surface-container p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary-container text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-container/25">
                  <span className="material-symbols-outlined text-[28px]">handshake</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Bạn là hướng dẫn viên hay công ty lữ hành?</h3>
                </div>
              </div>
              <div className="shrink-0">
                <Link
                  href="/agency"
                  className="inline-flex items-center gap-2 bg-on-surface text-white hover:bg-primary font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-md transform hover:-translate-y-0.5"
                >
                  <span>Truy cập Cổng đối tác</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </Container>
        </div>
      </div>

      <GuestLoginPromptModal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        redirectUrl={selectedTourPrompt.href || '/tours'}
        tourTitle={selectedTourPrompt.title}
      />
    </>
  );
}
