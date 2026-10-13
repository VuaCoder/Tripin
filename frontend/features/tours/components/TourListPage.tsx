'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { useGetTourCategoriesQuery, useGetToursQuery } from '../api/toursApi';
import type { ListToursArgs, TourSort } from '../types';
import { TourCard } from './TourCard';
import { formatCategoryName, formatVnd } from '../utils';
import { usePreloader } from '@/components/preloader';

const PAGE_SIZE = 12;
const SORT_OPTIONS: { value: TourSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'rating', label: 'Được yêu thích nhất' },
];

const PRICE_MIN = 0;
const PRICE_MAX = 20_000_000;
const PRICE_STEP = 100_000;

const RATING_OPTIONS = [
  { value: 4.5, label: '4.5 sao trở lên', stars: 5 },
  { value: 4, label: '4 sao trở lên', stars: 4 },
  { value: 3.5, label: '3.5 sao trở lên', stars: 4 },
  { value: 3, label: '3 sao trở lên', stars: 3 },
];

const numberParam = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const positiveNumberParam = (value: string | null): number | undefined => {
  const number = numberParam(value);
  return number !== undefined && number >= 1 ? number : undefined;
};

const positiveIntParam = (value: string | null, fallback: number): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const stringParam = (value: string | null): string | undefined => value?.trim() || undefined;

/** Trang khám phá tour — kết nối với endpoint tìm kiếm tour công khai. */
export function TourListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const qFromUrl = searchParams.get('q') ?? '';
  const [searchTerm, setSearchTerm] = useState(qFromUrl);

  // --- Price slider local state ---
  const urlMinPrice = numberParam(searchParams.get('minPrice')) ?? PRICE_MIN;
  const urlMaxPrice = numberParam(searchParams.get('maxPrice')) ?? PRICE_MAX;
  const [localMinPrice, setLocalMinPrice] = useState(urlMinPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(urlMaxPrice);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync slider state when URL params change externally
  useEffect(() => {
    setLocalMinPrice(numberParam(searchParams.get('minPrice')) ?? PRICE_MIN);
    setLocalMaxPrice(numberParam(searchParams.get('maxPrice')) ?? PRICE_MAX);
  }, [searchParams]);

  // Has departure date from home page?
  const hasDepartureFilter = Boolean(searchParams.get('departureFrom') || searchParams.get('departureTo'));

  const args = useMemo<ListToursArgs>(() => {
    const rawSort = searchParams.get('sort');
    const sort = SORT_OPTIONS.some((option) => option.value === rawSort) ? (rawSort as TourSort) : 'newest';
    return {
      page: positiveIntParam(searchParams.get('page'), 1),
      limit: PAGE_SIZE,
      ...(stringParam(searchParams.get('q')) ? { q: stringParam(searchParams.get('q')) } : {}),
      ...(stringParam(searchParams.get('categoryId')) ? { categoryId: stringParam(searchParams.get('categoryId')) } : {}),
      ...(stringParam(searchParams.get('destination')) ? { destination: stringParam(searchParams.get('destination')) } : {}),
      ...(numberParam(searchParams.get('minPrice')) !== undefined ? { minPrice: numberParam(searchParams.get('minPrice')) } : {}),
      ...(numberParam(searchParams.get('maxPrice')) !== undefined ? { maxPrice: numberParam(searchParams.get('maxPrice')) } : {}),
      ...(positiveNumberParam(searchParams.get('minDays')) !== undefined ? { minDays: positiveNumberParam(searchParams.get('minDays')) } : {}),
      ...(positiveNumberParam(searchParams.get('maxDays')) !== undefined ? { maxDays: positiveNumberParam(searchParams.get('maxDays')) } : {}),
      ...(stringParam(searchParams.get('departureFrom')) ? { departureFrom: stringParam(searchParams.get('departureFrom')) } : {}),
      ...(stringParam(searchParams.get('departureTo')) ? { departureTo: stringParam(searchParams.get('departureTo')) } : {}),
      ...(numberParam(searchParams.get('minRating')) !== undefined ? { minRating: numberParam(searchParams.get('minRating')) } : {}),
      sort,
    };
  }, [queryString, searchParams]);

  const { data, isLoading, isFetching, isError, refetch } = useGetToursQuery(args);
  const { data: categories = [] } = useGetTourCategoriesQuery();

  const { start: startPreloader, stop: stopPreloader } = usePreloader();

  // Preloader lifecycle: start when loading or refetching, dismiss ONLY when data is fully ready on screen
  useEffect(() => {
    if (isLoading || isFetching) {
      startPreloader();
    } else if (data || isError) {
      stopPreloader();
    }
  }, [isLoading, isFetching, data, isError, startPreloader, stopPreloader]);

  useEffect(() => {
    return () => {
      stopPreloader();
    };
  }, [stopPreloader]);

  const updateQuery = useCallback(
    (changes: Record<string, string | number | undefined>, resetPage = true, triggerPreloader = true) => {
      if (triggerPreloader) {
        startPreloader();
      }
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      const nextQuery = next.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, startPreloader],
  );

  useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

  useEffect(() => {
    if (searchTerm === qFromUrl) return;
    const timer = window.setTimeout(() => updateQuery({ q: searchTerm }, true, false), 350);
    return () => window.clearTimeout(timer);
  }, [qFromUrl, searchTerm, updateQuery]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const activeCategoryId = searchParams.get('categoryId') ?? '';

  const updateDateRange = (key: 'departureFrom' | 'departureTo', value: string) => {
    const counterpart = key === 'departureFrom' ? 'departureTo' : 'departureFrom';
    const other = searchParams.get(counterpart);
    const clearsOther = Boolean(value && other && ((key === 'departureFrom' && value > other) || (key === 'departureTo' && value < other)));
    updateQuery({ [key]: value || undefined, ...(clearsOther ? { [counterpart]: undefined } : {}) });
  };

  const clearFilters = () => {
    startPreloader();
    setSearchTerm('');
    setLocalMinPrice(PRICE_MIN);
    setLocalMaxPrice(PRICE_MAX);
    router.replace(pathname, { scroll: false });
  };

  // Handle price slider change with debounce
  const handlePriceSliderChange = (type: 'min' | 'max', rawValue: number) => {
    if (type === 'min') {
      const clamped = Math.min(rawValue, localMaxPrice - PRICE_STEP);
      setLocalMinPrice(clamped);
    } else {
      const clamped = Math.max(rawValue, localMinPrice + PRICE_STEP);
      setLocalMaxPrice(clamped);
    }
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
    sliderDebounceRef.current = setTimeout(() => {
      const min = type === 'min' ? Math.min(rawValue, localMaxPrice - PRICE_STEP) : localMinPrice;
      const max = type === 'max' ? Math.max(rawValue, localMinPrice + PRICE_STEP) : localMaxPrice;
      updateQuery({
        minPrice: min > PRICE_MIN ? min : undefined,
        maxPrice: max < PRICE_MAX ? max : undefined,
      });
    }, 400);
  };

  // Active filter count for badge
  const activeFilterCount = [
    searchParams.get('destination'),
    searchParams.get('minPrice') || searchParams.get('maxPrice'),
    searchParams.get('minRating'),
    searchParams.get('departureFrom') || searchParams.get('departureTo'),
    searchParams.get('minDays') || searchParams.get('maxDays'),
    searchParams.get('guests'),
  ].filter(Boolean).length;

  if (isLoading && !data) {
    return null;
  }
  if (isError || !data) {
    return <ErrorState title="Không tải được danh sách tour" message="Vui lòng kiểm tra kết nối và thử lại." onAction={() => void refetch()} />;
  }

  const { items, meta } = data;
  const firstResult = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastResult = Math.min(meta.page * meta.limit, meta.total);
  const minPricePercent = ((localMinPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPricePercent = ((localMaxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const currentMinRating = numberParam(searchParams.get('minRating'));

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Thanh tìm kiếm chính */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Khám phá tour</h1>
          <p className="mt-1 text-sm text-slate-500">Tìm hành trình phù hợp từ hàng trăm lựa chọn trên Tripri</p>
        </div>
        <label className="relative block w-full max-w-md" htmlFor="tour-search">
          <span className="sr-only">Tìm kiếm tour</span>
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" aria-hidden="true">search</span>
          <Input id="tour-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo tên tour, điểm đến..." className="min-h-11 rounded-xl border-slate-200 bg-white py-2.5 pl-11 pr-4 shadow-sm" />
        </label>
      </div>

      {/* Danh mục tour */}
      <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1" aria-label="Danh mục tour">
        <button type="button" onClick={() => updateQuery({ categoryId: undefined })} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${!activeCategoryId ? 'border-primary-container bg-primary-container text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-container'}`}>Tất cả</button>
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => updateQuery({ categoryId: category.id })} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${activeCategoryId === category.id ? 'border-primary-container bg-primary-container text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-container'}`}>{formatCategoryName(category.name)}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ======================== BỘ LỌC BÊN TRÁI ======================== */}
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <span className="material-symbols-outlined text-[20px] text-primary-container" aria-hidden="true">tune</span>
              Bộ lọc
              {activeFilterCount > 0 && (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-white">{activeFilterCount}</span>
              )}
            </h2>
            <button type="button" onClick={clearFilters} className="text-xs font-bold text-primary-container hover:text-primary transition-colors">Xóa tất cả</button>
          </div>

          <div className="mt-5 space-y-5">
            {/* Điểm đến */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="filter-destination">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">location_on</span>
                Điểm đến
              </label>
              <Input id="filter-destination" value={searchParams.get('destination') ?? ''} onChange={(event) => updateQuery({ destination: event.target.value })} placeholder="Ví dụ: Đà Nẵng, Hội An..." className="rounded-xl" />
            </div>

            {/* Sắp xếp */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="filter-sort">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">swap_vert</span>
                Sắp xếp theo
              </label>
              <select id="filter-sort" value={args.sort ?? 'newest'} onChange={(event) => updateQuery({ sort: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20">
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            {/* Khoảng giá — Thanh kéo */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">payments</span>
                Khoảng giá
              </p>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">{formatVnd(localMinPrice)}</span>
                <span className="text-slate-400">—</span>
                <span className="font-semibold">{localMaxPrice >= PRICE_MAX ? `${formatVnd(PRICE_MAX)}+` : formatVnd(localMaxPrice)}</span>
              </div>
              <div className="relative h-6 px-1">
                {/* Track */}
                <div className="absolute left-1 right-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                {/* Active range */}
                <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary-container" style={{ left: `calc(${minPricePercent}% + 4px)`, right: `calc(${100 - maxPricePercent}% + 4px)` }} />
                {/* Min thumb */}
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  value={localMinPrice}
                  onChange={(e) => handlePriceSliderChange('min', Number(e.target.value))}
                  className="price-slider absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
                  style={{ zIndex: localMinPrice > PRICE_MAX - PRICE_STEP * 2 ? 5 : 3 }}
                  aria-label="Giá thấp nhất"
                />
                {/* Max thumb */}
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  value={localMaxPrice}
                  onChange={(e) => handlePriceSliderChange('max', Number(e.target.value))}
                  className="price-slider absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
                  style={{ zIndex: 4 }}
                  aria-label="Giá cao nhất"
                />
              </div>
            </div>

            {/* Ngày khởi hành (thay thế cho Thời lượng nếu đã chọn ngày) */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">calendar_month</span>
                Ngày khởi hành
              </p>
              <div className="space-y-2">
                <Input type="date" value={searchParams.get('departureFrom') ?? ''} onChange={(event) => updateDateRange('departureFrom', event.target.value)} aria-label="Từ ngày" className="rounded-xl" />
                <Input type="date" value={searchParams.get('departureTo') ?? ''} onChange={(event) => updateDateRange('departureTo', event.target.value)} aria-label="Đến ngày" className="rounded-xl" />
              </div>
            </div>

            {/* Thời lượng (ẩn khi đã chọn ngày khởi hành) */}
            {!hasDepartureFilter && (
              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-700">
                  <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">schedule</span>
                  Thời lượng
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '1 ngày', min: 1, max: 1 },
                    { label: '2-3 ngày', min: 2, max: 3 },
                    { label: '4-7 ngày', min: 4, max: 7 },
                    { label: '7+ ngày', min: 7, max: undefined },
                  ].map((opt) => {
                    const isActive = positiveNumberParam(searchParams.get('minDays')) === opt.min && (opt.max === undefined ? !searchParams.get('maxDays') : positiveNumberParam(searchParams.get('maxDays')) === opt.max);
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => updateQuery({
                          minDays: isActive ? undefined : opt.min,
                          maxDays: isActive ? undefined : opt.max,
                        })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'border-primary-container bg-primary-container/10 text-primary-container' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Số lượng khách */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">group</span>
                Số lượng khách
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const current = positiveIntParam(searchParams.get('guests') ?? '', 0);
                    updateQuery({ guests: current > 1 ? current - 1 : undefined });
                  }}
                  className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-800 hover:text-slate-800 disabled:opacity-30"
                  disabled={!searchParams.get('guests') || Number(searchParams.get('guests')) <= 0}
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span className="min-w-[2.5rem] text-center text-sm font-bold text-slate-800">
                  {searchParams.get('guests') || '—'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const current = positiveIntParam(searchParams.get('guests') ?? '', 0);
                    updateQuery({ guests: current + 1 });
                  }}
                  className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-800 hover:text-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <span className="text-xs text-slate-500">khách</span>
              </div>
            </div>

            {/* Đánh giá — Ô chọn */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">star</span>
                Đánh giá
              </p>
              <div className="space-y-1.5">
                {RATING_OPTIONS.map((opt) => {
                  const isActive = currentMinRating === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateQuery({ minRating: isActive ? undefined : opt.value })}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${isActive ? 'border-primary-container bg-primary-container/10 text-primary-container font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={`material-symbols-outlined text-[14px] ${i < Math.floor(opt.value) ? 'text-amber-500' : i < opt.value ? 'text-amber-400' : 'text-slate-300'}`}>star</span>
                        ))}
                      </div>
                      <span>{opt.label}</span>
                      {isActive && <span className="material-symbols-outlined ml-auto text-[16px] text-primary-container">check_circle</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ======================== KẾT QUẢ ======================== */}
        <section aria-live="polite" aria-busy={isFetching}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600"><strong className="text-slate-900">{meta.total}</strong> tour phù hợp{meta.total > 0 && <span className="hidden sm:inline"> · Hiển thị {firstResult}–{lastResult}</span>}</p>
          </div>

          {items.length === 0 ? (
            <EmptyState title="Chưa tìm thấy tour phù hợp" description="Thử thay đổi từ khóa hoặc mở rộng bộ lọc để khám phá thêm lựa chọn." actionLabel="Xóa bộ lọc" onAction={clearFilters} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((tour) => <TourCard key={tour.id} tour={tour} categoryName={tour.categoryIds.map((id) => categoryById.get(id)).find(Boolean)} />)}
            </div>
          )}

          {meta.totalPages > 1 && (
            <nav aria-label="Phân trang tour" className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={meta.page <= 1 || isFetching} onClick={() => updateQuery({ page: meta.page - 1 }, false)}>Trước</Button>
              <span className="text-sm text-slate-600">Trang {meta.page}/{meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages || isFetching} onClick={() => updateQuery({ page: meta.page + 1 }, false)}>Sau</Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
