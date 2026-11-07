'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Pagination, AntSelect, AntDateRangePicker } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { useGetTourCategoriesQuery, useGetToursQuery } from '../api/toursApi';
import type { ListToursArgs, TourSort } from '../types';
import { TourCard } from './TourCard';
import { formatCategoryName, formatVnd } from '../utils';
import { cn } from '@/components/ui/cn';

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

export function TourGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse" role="status" aria-label="Đang tải danh sách tour">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="aspect-[16/10] w-full bg-slate-200" />
          <div className="flex flex-1 flex-col p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-4 w-12 rounded bg-slate-100" />
            </div>
            <div className="h-5 w-4/5 rounded bg-slate-200" />
            <div className="h-3 w-3/5 rounded bg-slate-100" />
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Đang tải danh sách tour...</span>
    </div>
  );
}

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

  const updateQuery = useCallback(
    (changes: Record<string, string | number | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      const nextQuery = next.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => setSearchTerm(qFromUrl), [qFromUrl]);

  useEffect(() => {
    if (searchTerm === qFromUrl) return;
    const timer = window.setTimeout(() => updateQuery({ q: searchTerm || undefined }, true), 350);
    return () => window.clearTimeout(timer);
  }, [qFromUrl, searchTerm, updateQuery]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const activeCategoryId = searchParams.get('categoryId') ?? '';

  useEffect(() => () => { if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current); }, []);

  const clearFilters = () => {
    if (sliderDebounceRef.current) clearTimeout(sliderDebounceRef.current);
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
    Boolean(args.q),
    Boolean(args.categoryId),
    Boolean(args.destination),
    args.minPrice !== undefined && args.minPrice > PRICE_MIN || args.maxPrice !== undefined && args.maxPrice < PRICE_MAX,
    args.minRating !== undefined && args.minRating > 0,
    Boolean(args.departureFrom || args.departureTo),
    Boolean(args.minDays || args.maxDays),
    positiveIntParam(searchParams.get('guests'), 0) > 0,
  ].filter(Boolean).length;

  if (isError && !data) {
    return <ErrorState title="Không tải được danh sách tour" message="Vui lòng kiểm tra kết nối và thử lại." onAction={() => void refetch()} />;
  }

  const items = data?.items ?? [];
  const meta = data?.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
  const firstResult = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastResult = Math.min(meta.page * meta.limit, meta.total);
  const minPricePercent = ((localMinPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPricePercent = ((localMaxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const currentMinRating = numberParam(searchParams.get('minRating'));

  return (
    <div className="w-full pb-8">
      {/* Tiêu đề trang */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Khám phá tour</h1>
          <p className="mt-1 text-sm text-slate-500">Tìm hành trình phù hợp từ hàng trăm lựa chọn trên Tripri</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ======================== BỘ LỌC BÊN TRÁI ======================== */}
        <aside className="h-fit max-h-[calc(100vh-7rem)] overflow-y-auto ant-scrollbar rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <span className="material-symbols-outlined text-[20px] text-primary-container" aria-hidden="true">tune</span>
              Bộ lọc
              {activeFilterCount > 0 && (
                <span aria-label={`${activeFilterCount} bộ lọc đang áp dụng`} className="inline-flex size-5 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-white">{activeFilterCount}</span>
              )}
            </h2>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-primary-container hover:text-primary transition-colors cursor-pointer">Xóa tất cả</button>}
          </div>

          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor="filter-category" className="mb-1.5 block text-xs font-bold text-slate-700">Danh mục tour</label>
              <AntSelect
                id="filter-category"
                value={activeCategoryId}
                onChange={value => updateQuery({ categoryId: value || undefined })}
                options={[{ value: '', label: 'Tất cả' }, ...categories.map(category => ({ value: category.id, label: formatCategoryName(category.name) }))]}
                className="w-full"
                size="large"
              />
            </div>
            {/* 1. Điểm đến */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="filter-destination">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">location_on</span>
                Điểm đến
              </label>
              <Input id="filter-destination" value={searchParams.get('destination') ?? ''} onChange={(event) => updateQuery({ destination: event.target.value })} placeholder="Ví dụ: Đà Nẵng, Hội An..." className="rounded-xl" />
            </div>

            {/* 2. Ngày khởi hành */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">calendar_month</span>
                Ngày khởi hành
              </p>
              <AntDateRangePicker
                startDate={searchParams.get('departureFrom') ?? undefined}
                endDate={searchParams.get('departureTo') ?? undefined}
                placeholder={['Từ ngày', 'Đến ngày']}
                onChange={({ startDate, endDate }) => {
                  updateQuery({
                    departureFrom: startDate,
                    departureTo: endDate,
                  });
                }}
                className="w-full"
                size="large"
              />
            </div>

            {/* 3. Khoảng giá — Thanh kéo */}
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

            {/* 4. Sắp xếp */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="filter-sort">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">swap_vert</span>
                Sắp xếp theo
              </label>
              <AntSelect
                value={args.sort ?? 'newest'}
                onChange={(val) => updateQuery({ sort: val })}
                options={SORT_OPTIONS}
                className="w-full"
                size="large"
              />
            </div>

            {/* 5. Thời lượng */}
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

            {/* 6. Số lượng khách */}
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
                  className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-800 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
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
                  className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-800 hover:text-slate-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <span className="text-xs text-slate-500">khách</span>
              </div>
            </div>

            {/* 7. Số sao (Đánh giá) */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">star</span>
                Đánh giá (Số sao)
              </p>
              <div className="space-y-1.5">
                {RATING_OPTIONS.map((opt) => {
                  const isActive = currentMinRating === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateQuery({ minRating: isActive ? undefined : opt.value })}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${isActive ? 'border-primary-container bg-primary-container/10 text-primary-container font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
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
            {isLoading && !data ? (
              <div className="h-5 w-36 rounded bg-slate-200 animate-pulse" />
            ) : (
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900">{meta.total}</strong> tour phù hợp{meta.total > 0 && <span className="hidden sm:inline"> · Hiển thị {firstResult}–{lastResult}</span>}
              </p>
            )}
          </div>

          {isLoading && !data ? (
            <TourGridSkeleton />
          ) : items.length === 0 ? (
            <EmptyState title="Chưa tìm thấy tour phù hợp" description="Thử thay đổi từ khóa hoặc mở rộng bộ lọc để khám phá thêm lựa chọn." actionLabel={activeFilterCount > 0 ? "Xóa bộ lọc" : undefined} onAction={activeFilterCount > 0 ? clearFilters : undefined} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((tour) => <TourCard key={tour.id} tour={tour} categoryName={tour.categoryIds.map((id) => categoryById.get(id)).find(Boolean)} />)}
            </div>
          )}

          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            pageSize={PAGE_SIZE}
            itemLabel="tour"
            onPageChange={(p) => updateQuery({ page: p }, false)}
            disabled={isFetching}
            className="mt-8"
          />
        </section>
      </div>
    </div>
  );
}
