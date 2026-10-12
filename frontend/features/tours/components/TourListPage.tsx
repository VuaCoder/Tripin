'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { useGetTourCategoriesQuery, useGetToursQuery } from '../api/toursApi';
import type { ListToursArgs, TourSort } from '../types';
import { TourCard } from './TourCard';

const PAGE_SIZE = 12;
const SORT_OPTIONS: { value: TourSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá thấp đến cao' },
  { value: 'price_desc', label: 'Giá cao đến thấp' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
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

/** Public discovery page backed exclusively by the approved-tour search endpoint. */
export function TourListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const qFromUrl = searchParams.get('q') ?? '';
  const [searchTerm, setSearchTerm] = useState(qFromUrl);

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
    const timer = window.setTimeout(() => updateQuery({ q: searchTerm }), 350);
    return () => window.clearTimeout(timer);
  }, [qFromUrl, searchTerm, updateQuery]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const items = data?.items ?? [];
  const meta = data?.meta;
  const activeCategoryId = searchParams.get('categoryId') ?? '';

  const updateNumberRange = (key: 'minPrice' | 'maxPrice' | 'minDays' | 'maxDays', raw: string) => {
    const value = raw.trim() === '' ? undefined : Number(raw);
    const minValue = key.endsWith('Days') ? 1 : 0;
    if (value !== undefined && (!Number.isInteger(value) || value < minValue)) return;
    const counterpart: Record<typeof key, typeof key> = {
      minPrice: 'maxPrice', maxPrice: 'minPrice', minDays: 'maxDays', maxDays: 'minDays',
    };
    const other = numberParam(searchParams.get(counterpart[key]));
    const clearsOther = value !== undefined && other !== undefined && ((key.startsWith('min') && value > other) || (key.startsWith('max') && value < other));
    updateQuery({ [key]: value, ...(clearsOther ? { [counterpart[key]]: undefined } : {}) });
  };

  const updateDateRange = (key: 'departureFrom' | 'departureTo', value: string) => {
    const counterpart = key === 'departureFrom' ? 'departureTo' : 'departureFrom';
    const other = searchParams.get(counterpart);
    const clearsOther = Boolean(value && other && ((key === 'departureFrom' && value > other) || (key === 'departureTo' && value < other)));
    updateQuery({ [key]: value || undefined, ...(clearsOther ? { [counterpart]: undefined } : {}) });
  };

  const clearFilters = () => {
    setSearchTerm('');
    router.replace(pathname, { scroll: false });
  };

  if (isLoading) return <LoadingState label="Đang khám phá các tour phù hợp..." className="min-h-[52vh]" />;
  if (isError || !data) {
    return <ErrorState title="Không tải được danh sách tour" message="Vui lòng kiểm tra kết nối và thử lại." onAction={() => void refetch()} />;
  }

  const firstResult = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const lastResult = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="rounded-3xl border border-teal-200/90 bg-gradient-to-br from-teal-100 via-cyan-50 to-sky-100 px-5 py-7 shadow-[0_16px_40px_rgba(8,126,139,0.08)] sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-container">Khám phá Việt Nam</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Tìm tour phù hợp với bạn</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Chọn hành trình từ các nhà cung cấp trên Tripri, xem ngày khởi hành và mức giá rõ ràng trước khi quyết định.</p>
        <label className="relative mt-5 block max-w-3xl" htmlFor="tour-search">
          <span className="sr-only">Tìm kiếm tour</span>
          <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-primary-container" aria-hidden="true">search</span>
          <Input id="tour-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo tên tour, điểm đến hoặc trải nghiệm..." className="min-h-12 rounded-2xl border-white bg-white py-3 pl-12 pr-4 shadow-lg shadow-slate-900/10" />
        </label>
      </header>

      <div className="mt-6 flex flex-wrap gap-2 overflow-x-auto pb-1" aria-label="Danh mục tour">
        <button type="button" onClick={() => updateQuery({ categoryId: undefined })} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${!activeCategoryId ? 'border-primary-container bg-primary-container text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-container'}`}>Tất cả</button>
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => updateQuery({ categoryId: category.id })} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${activeCategoryId === category.id ? 'border-primary-container bg-primary-container text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-container'}`}>{category.name}</button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-slate-900">Lọc tour</h2>
            <button type="button" onClick={clearFilters} className="text-xs font-bold text-primary-container hover:text-primary">Xóa lọc</button>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-bold text-slate-700">Điểm đến<Input value={searchParams.get('destination') ?? ''} onChange={(event) => updateQuery({ destination: event.target.value })} placeholder="Ví dụ: Đà Nẵng" className="mt-1.5" /></label>
            <label className="block text-xs font-bold text-slate-700">Sắp xếp<select value={args.sort ?? 'newest'} onChange={(event) => updateQuery({ sort: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20">{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <div><p className="text-xs font-bold text-slate-700">Khoảng giá (VNĐ)</p><div className="mt-1.5 grid grid-cols-2 gap-2"><Input type="number" min={0} step={100000} value={searchParams.get('minPrice') ?? ''} onChange={(event) => updateNumberRange('minPrice', event.target.value)} placeholder="Từ" /><Input type="number" min={0} step={100000} value={searchParams.get('maxPrice') ?? ''} onChange={(event) => updateNumberRange('maxPrice', event.target.value)} placeholder="Đến" /></div></div>
            <div><p className="text-xs font-bold text-slate-700">Thời lượng (ngày)</p><div className="mt-1.5 grid grid-cols-2 gap-2"><Input type="number" min={1} step={1} value={searchParams.get('minDays') ?? ''} onChange={(event) => updateNumberRange('minDays', event.target.value)} placeholder="Từ" /><Input type="number" min={1} step={1} value={searchParams.get('maxDays') ?? ''} onChange={(event) => updateNumberRange('maxDays', event.target.value)} placeholder="Đến" /></div></div>
            <label className="block text-xs font-bold text-slate-700">Đánh giá tối thiểu<select value={searchParams.get('minRating') ?? ''} onChange={(event) => updateQuery({ minRating: event.target.value || undefined })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"><option value="">Tất cả đánh giá</option><option value="4">Từ 4 sao</option><option value="4.5">Từ 4,5 sao</option></select></label>
            <div><p className="text-xs font-bold text-slate-700">Ngày khởi hành</p><div className="mt-1.5 space-y-2"><Input type="date" value={searchParams.get('departureFrom') ?? ''} onChange={(event) => updateDateRange('departureFrom', event.target.value)} aria-label="Khởi hành từ ngày" /><Input type="date" value={searchParams.get('departureTo') ?? ''} onChange={(event) => updateDateRange('departureTo', event.target.value)} aria-label="Khởi hành đến ngày" /></div></div>
          </div>
        </aside>

        <section aria-live="polite" aria-busy={isFetching}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600"><strong className="text-slate-900">{meta.total}</strong> tour phù hợp{meta.total > 0 && <span className="hidden sm:inline"> · Hiển thị {firstResult}–{lastResult}</span>}</p>
            {isFetching && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-container"><span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Đang cập nhật</span>}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Chưa tìm thấy tour phù hợp" description="Hãy thử thay đổi từ khóa hoặc nới rộng điều kiện lọc của bạn." actionLabel="Xóa bộ lọc" onAction={clearFilters} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
