'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, X, Compass, MapPin, Clock, Eye, AlertOctagon } from 'lucide-react';
import { GridListToggle } from '@/components/ui/GridListToggle';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination, AntSelect, Modal, type AntSelectOption } from '@/components/ui';
import { useGetModerationTourQuery, useGetModerationToursQuery, useSuspendTourMutation, useValidateTourMutation } from '../api/moderationApi';
import { PERMISSION, TOUR_STATUS_LABELS } from '../labels';
import type { ModerationTour, ModerationTourStatus } from '../types';
import { ModeratorTourDetailModal } from './ModeratorTourDetailModal';
import { dateTime, FeedbackBanner, ModerationDenied, money, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 12;
type StatusFilter = 'ALL' | ModerationTourStatus;

interface Props {
  initialStatus?: StatusFilter;
}

/** Formats tour date: "18:48 - 01/11", or "18:48 - 01/11/26" if another year */
export function formatTourDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const time = `${hours}:${minutes}`;
  if (d.getFullYear() !== now.getFullYear()) {
    const yearShort = String(d.getFullYear()).slice(-2);
    return `${time} - ${day}/${month}/${yearShort}`;
  }
  return `${time} - ${day}/${month}`;
}

/** Shimmer / Skeleton loading for moderation tour list */
export function ModerationTourSkeleton({ viewMode }: { viewMode: 'list' | 'grid' }) {
  return (
    <div role="status" aria-label="Đang tải danh sách tour">
      <p className="sr-only">Đang tải danh sách tour...</p>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs animate-pulse"
            >
              <div>
                {/* Image Shimmer */}
                <div className="relative aspect-[16/10] w-full bg-slate-200">
                  <div className="absolute left-3 top-3 h-5 w-20 rounded-full bg-slate-300" />
                  <div className="absolute bottom-2.5 right-2.5 h-6 w-16 rounded-xl bg-slate-300" />
                </div>
                {/* Content Shimmer */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="h-2 w-2 rounded-full bg-slate-200" />
                    <div className="h-3 w-28 rounded bg-slate-200" />
                  </div>
                  <div className="h-5 w-4/5 rounded-lg bg-slate-200" />
                  <div className="h-4 w-3/5 rounded-lg bg-slate-100" />
                  <div className="h-5 w-24 rounded bg-slate-200 pt-1" />
                </div>
              </div>
              {/* Footer Shimmer */}
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-7 w-24 rounded-xl bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs animate-pulse"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="h-20 w-24 sm:h-24 sm:w-32 rounded-2xl bg-slate-200 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-24 rounded bg-slate-200" />
                      <div className="h-3 w-16 rounded bg-slate-100" />
                      <div className="h-3 w-28 rounded bg-slate-200" />
                    </div>
                    <div className="h-5 w-3/4 rounded-lg bg-slate-200" />
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                      <div className="h-3 w-24 rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="h-8 w-24 rounded-xl bg-slate-200 shrink-0 self-end sm:self-center" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Use cases "View tour lists", "Validate tour" and "Suspend tours". */
export function ModerationTourListPage({ initialStatus = 'PENDING_REVIEW' }: Props) {
  const canList = useModerationPermission(PERMISSION.tourList);
  const canValidate = useModerationPermission(PERMISSION.tourValidate);
  const canSuspend = useModerationPermission(PERMISSION.tourSuspend);

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>(initialStatus);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading, isFetching, isError, refetch } = useGetModerationToursQuery(
    { page, limit: PAGE_SIZE, ...(filter === 'ALL' ? {} : { status: filter }), ...(q ? { q } : {}) },
    { skip: !canList, refetchOnMountOrArgChange: 60 },
  );
  const [validate, { isLoading: isValidating }] = useValidateTourMutation();
  const [suspend, { isLoading: isSuspending }] = useSuspendTourMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selectedDetail, isFetching: isLoadingDetail, isError: isDetailError, refetch: refetchDetail } = useGetModerationTourQuery(selectedId ?? '', { skip: !selectedId || !canList, refetchOnMountOrArgChange: 60 });
  const [quickActionTour, setQuickActionTour] = useState<{ id: string; action: 'suspend' | 'reject'; title: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canList) return <ModerationDenied />;

  // Always read the open tour from the cache so the dialog reflects what the backend returned.
  const selected: ModerationTour | null = selectedDetail?.id === selectedId ? selectedDetail : null;

  const close = () => {
    setSelectedId(null);
    setServerError(null);
  };

  // The UI only reports success after the backend has confirmed (`unwrap` throws on any error).
  const decide = async (run: () => Promise<unknown>, successMessage: string, failure: string) => {
    setServerError(null);
    try {
      await run();
      setFeedback({ message: successMessage, type: 'success' });
      close();
    } catch (err: unknown) {
      setServerError(moderationErrorMessage(err, failure));
      void refetch();
    }
  };

  const statusOptions: AntSelectOption<StatusFilter>[] = [
    { value: 'PENDING_REVIEW', label: TOUR_STATUS_LABELS.PENDING_REVIEW.label },
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'APPROVED', label: TOUR_STATUS_LABELS.APPROVED.label },
    { value: 'REJECTED', label: TOUR_STATUS_LABELS.REJECTED.label },
    { value: 'SUSPENDED', label: TOUR_STATUS_LABELS.SUSPENDED.label },
    { value: 'DRAFT', label: TOUR_STATUS_LABELS.DRAFT.label },
    { value: 'ARCHIVED', label: TOUR_STATUS_LABELS.ARCHIVED.label },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-1 py-2 sm:px-0">
      {/* Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Kiểm duyệt tour</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Smooth Expandable Search */}
          <div
            className={`relative flex h-10 items-center transition-all duration-300 ease-out ${
              isSearchExpanded || search ? 'w-56 sm:w-80' : 'w-10'
            }`}
          >
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Tìm theo tên tour, điểm đến hoặc agency"
              placeholder="Tìm theo tên tour, điểm đến hoặc agency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('');
                  setQ('');
                  setIsSearchExpanded(false);
                  searchInputRef.current?.blur();
                }
              }}
              className={`h-10 w-full rounded-2xl border border-slate-200/90 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs outline-none transition-all duration-300 ease-out hover:border-slate-300 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 ${
                isSearchExpanded || search
                  ? 'pl-9 pr-8 opacity-100 cursor-text'
                  : 'pl-10 pr-0 opacity-0 pointer-events-none cursor-pointer'
              }`}
            />

            {isSearchExpanded || search ? (
              <>
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 transition-opacity duration-200" />
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setQ('');
                    setIsSearchExpanded(false);
                    setPage(1);
                  }}
                  aria-label="Đóng tìm kiếm"
                  title="Đóng tìm kiếm (Esc)"
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="size-3.5 transition-transform duration-200 hover:rotate-90" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                aria-label="Tìm kiếm theo tên tour"
                title="Tìm kiếm theo tên tour"
                className="absolute inset-0 flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-brand-teal active:scale-95 cursor-pointer"
              >
                <Search className="size-4 transition-transform duration-200 group-hover:scale-110" />
              </button>
            )}
          </div>

          {/* AntSelect Filter Dropdown */}
          <AntSelect<StatusFilter>
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(val) => {
              setFilter(val);
              setPage(1);
            }}
            options={statusOptions}
            size="middle"
            className="min-w-[165px]"
            triggerClassName={filter !== 'ALL' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
          />

          <GridListToggle value={viewMode} onChange={setViewMode} />

          {/* Refresh Button */}
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {isLoading ? (
        <ModerationTourSkeleton viewMode={viewMode} />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách tour" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có tour nào" description="Không có tour nào khớp với bộ lọc hiện tại." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ========================================================================= */}
          {/* GRID VIEW                                                                 */}
          {/* ========================================================================= */}
          {viewMode === 'grid' ? (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((t) => {
                const status = TOUR_STATUS_LABELS[t.status];
                const tourImage = t.coverImage || t.images?.[0];

                return (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết tour ${t.title}`}
                    onClick={() => { setServerError(null); setSelectedId(t.id); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setServerError(null);
                        setSelectedId(t.id);
                      }
                    }}
                    className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                  >
                    <div>
                      {/* Cover Photo */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                        {tourImage ? (
                          <img
                            src={tourImage}
                            alt={t.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300 bg-slate-50">
                            <Compass className="size-12 stroke-[1.2]" />
                          </div>
                        )}
                        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs ${status.className}`}>
                          {status.label}
                        </span>
                        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-xl bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white shadow-xs">
                          <Clock className="size-3" />
                          <span>{t.durationDays} ngày</span>
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                          <MapPin className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{t.destination}</span>
                          <span>•</span>
                          <span className="truncate">{t.agency?.name ?? 'Không rõ agency'}</span>
                        </div>
                        <h3 className="line-clamp-2 text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                          {t.title}
                        </h3>
                        <p className="mt-2.5 text-base font-extrabold text-teal-800">
                          {money.format(t.basePrice)}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {formatTourDate(t.updatedAt)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-900 shadow-2xs transition group-hover:bg-teal-50"
                        >
                          <Eye className="size-3.5 text-teal-700" />
                          <span>{t.status === 'PENDING_REVIEW' || t.status === 'APPROVED' ? 'Xem & xử lý' : 'Xem chi tiết'}</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            /* ========================================================================= */
            /* LIST VIEW                                                                 */
            /* ========================================================================= */
            <ul className="space-y-3">
              {data.items.map((t) => {
                const status = TOUR_STATUS_LABELS[t.status];
                const tourImage = t.coverImage || t.images?.[0];

                return (
                  <li
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết tour ${t.title}`}
                    onClick={() => { setServerError(null); setSelectedId(t.id); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setServerError(null);
                        setSelectedId(t.id);
                      }
                    }}
                    className="group cursor-pointer rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Thumbnail Image */}
                        <div className="relative h-20 w-24 sm:h-24 sm:w-32 overflow-hidden rounded-2xl bg-slate-100 shrink-0">
                          {tourImage ? (
                            <img
                              src={tourImage}
                              alt={t.title}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300 bg-slate-50">
                              <Compass className="size-8 stroke-[1.2]" />
                            </div>
                          )}
                          <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        {/* Text info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-600">
                              <MapPin className="size-3 text-slate-400" />
                              {t.destination}
                            </span>
                            <span>•</span>
                            <span>{t.durationDays} ngày</span>
                            <span>•</span>
                            <span className="truncate">{t.agency?.name ?? 'Không rõ agency'}</span>
                          </div>
                          <p className="mt-1 font-bold text-slate-900 group-hover:text-teal-900 transition-colors line-clamp-1 text-sm sm:text-base">
                            {t.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-extrabold text-teal-800 text-sm">
                              {money.format(t.basePrice)}
                            </span>
                            <span className="text-slate-400">
                              {formatTourDate(t.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-2 text-sm font-semibold text-teal-900 transition group-hover:bg-teal-100/80"
                        >
                          <Eye className="size-4 text-teal-700" />
                          <span>{t.status === 'PENDING_REVIEW' || t.status === 'APPROVED' ? 'Xem & xử lý' : 'Xem chi tiết'}</span>
                        </span>
                      </div>


                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            totalItems={data.meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={isFetching}
            showInfo
            itemLabel="tour"
          />
        </div>
      )}

      {/* Comprehensive Moderator Tour Detail Modal */}
      {selectedId && (
        <ModeratorTourDetailModal
          tourId={selectedId}
          initialTour={selected ?? undefined}
          canValidate={canValidate}
          canSuspend={canSuspend}
          isSubmitting={isValidating || isSuspending}
          serverError={serverError}
          onClose={close}
          onApprove={(reason) =>
            decide(
              () => validate({ id: selectedId, approve: true, ...(reason ? { reason } : {}) }).unwrap(),
              `Đã duyệt tour "${selected?.title ?? ''}".`,
              'Không thể duyệt tour lúc này. Vui lòng thử lại.',
            )
          }
          onReject={(reason) =>
            decide(
              () => validate({ id: selectedId, approve: false, reason }).unwrap(),
              `Đã từ chối tour "${selected?.title ?? ''}".`,
              'Không thể từ chối tour lúc này. Vui lòng thử lại.',
            )
          }
          onSuspend={(reason) =>
            decide(
              () => suspend({ id: selectedId, reason }).unwrap(),
              `Đã tạm ngưng tour "${selected?.title ?? ''}".`,
              'Không thể tạm ngưng tour lúc này. Vui lòng thử lại.',
            )
          }
        />
      )}

      {/* Quick Confirmation Modal */}
      {quickActionTour && (
        <Modal
          open={Boolean(quickActionTour)}
          onClose={() => setQuickActionTour(null)}
          title={quickActionTour.action === 'suspend' ? 'Xác nhận tạm ngưng tour' : 'Xác nhận từ chối tour'}
          className="max-w-md"
        >
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900">
              <p className="font-bold text-sm sm:text-base text-rose-900">
                {quickActionTour.action === 'suspend'
                  ? 'Bạn có chắc chắn muốn tạm ngưng tour này không?'
                  : 'Bạn có chắc chắn muốn từ chối tour này không?'}
              </p>
              <p className="mt-1.5 text-xs text-rose-700">
                Tour: <strong className="text-slate-900">{quickActionTour.title}</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setQuickActionTour(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isValidating || isSuspending}
                onClick={async () => {
                  const target = quickActionTour;
                  setQuickActionTour(null);
                  if (target.action === 'suspend') {
                    await decide(
                      () => suspend({ id: target.id, reason: 'Tạm ngưng theo yêu cầu kiểm duyệt' }).unwrap(),
                      `Đã tạm ngưng tour "${target.title}".`,
                      'Không thể tạm ngưng tour lúc này. Vui lòng thử lại.',
                    );
                  } else {
                    await decide(
                      () => validate({ id: target.id, approve: false, reason: 'Không đạt tiêu chuẩn kiểm duyệt của sàn' }).unwrap(),
                      `Đã từ chối tour "${target.title}".`,
                      'Không thể từ chối tour lúc này. Vui lòng thử lại.',
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {isValidating || isSuspending ? 'Đang xử lý...' : 'OK'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
