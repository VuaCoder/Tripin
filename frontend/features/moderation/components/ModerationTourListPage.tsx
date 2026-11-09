'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, X, LayoutGrid, List, Compass, MapPin, Clock } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination, AntSelect, Modal, type AntSelectOption } from '@/components/ui';
import { useGetModerationToursQuery, useSuspendTourMutation, useValidateTourMutation } from '../api/moderationApi';
import { PERMISSION, TOUR_STATUS_LABELS } from '../labels';
import type { ModerationTour, ModerationTourStatus } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
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

/** Use cases "View tour lists", "Validate tour" and "Suspend tours". */
export function ModerationTourListPage({ initialStatus = 'ALL' }: Props) {
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
    { skip: !canList },
  );
  const [validate, { isLoading: isValidating }] = useValidateTourMutation();
  const [suspend, { isLoading: isSuspending }] = useSuspendTourMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickActionTour, setQuickActionTour] = useState<{ id: string; action: 'suspend' | 'reject'; title: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canList) return <ModerationDenied />;

  // Always read the open tour from the cache so the dialog reflects what the backend returned.
  const selected: ModerationTour | null = data?.items.find((t) => t.id === selectedId) ?? null;

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

  const actions: DecisionAction[] = [];
  if (selected?.status === 'PENDING_REVIEW' && canValidate) {
    actions.push(
      {
        key: 'approve',
        label: 'Duyệt tour',
        tone: 'positive',
        requiresReason: false,
        onConfirm: (reason) =>
          void decide(() => validate({ id: selected.id, approve: true, ...(reason ? { reason } : {}) }).unwrap(), `Đã duyệt tour "${selected.title}".`, 'Không thể duyệt tour lúc này. Vui lòng thử lại.'),
      },
      {
        key: 'reject',
        label: 'Từ chối',
        tone: 'negative',
        requiresReason: true,
        onConfirm: (reason) =>
          void decide(() => validate({ id: selected.id, approve: false, reason }).unwrap(), `Đã từ chối tour "${selected.title}".`, 'Không thể từ chối tour lúc này. Vui lòng thử lại.'),
      },
    );
  }
  if (selected?.status === 'APPROVED' && canSuspend) {
    actions.push({
      key: 'suspend',
      label: 'Tạm ngưng tour',
      tone: 'negative',
      requiresReason: true,
      onConfirm: (reason) =>
        void decide(() => suspend({ id: selected.id, reason }).unwrap(), `Đã tạm ngưng tour "${selected.title}".`, 'Không thể tạm ngưng tour lúc này. Vui lòng thử lại.'),
    });
  }

  const reasonLabel =
    selected?.status === 'APPROVED' ? 'Lý do tạm ngưng (bắt buộc)' : 'Lý do (bắt buộc khi từ chối, tùy chọn khi duyệt)';

  const statusOptions: AntSelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    ...(Object.keys(TOUR_STATUS_LABELS) as ModerationTourStatus[]).map((s) => ({
      value: s,
      label: TOUR_STATUS_LABELS[s].label,
    })),
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
              isSearchExpanded || search ? 'w-56 sm:w-72' : 'w-10'
            }`}
          >
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Tìm theo tên tour"
              placeholder="Tìm theo tên tour..."
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

          {/* View Switcher: List vs Grid */}
          <div className="flex items-center rounded-2xl border border-slate-200/90 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Xem dạng lưới"
              title="Xem dạng lưới"
              className={`flex size-8 items-center justify-center rounded-xl transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-brand-teal text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Xem dạng danh sách"
              title="Xem dạng danh sách"
              className={`flex size-8 items-center justify-center rounded-xl transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-brand-teal text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <List className="size-4" />
            </button>
          </div>

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
        <LoadingState label="Đang tải danh sách tour..." />
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
                    className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md"
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
                        {t.status === 'APPROVED' && canSuspend && (
                          <button
                            type="button"
                            onClick={() => {
                              setServerError(null);
                              setQuickActionTour({ id: t.id, action: 'suspend', title: t.title });
                            }}
                            className="rounded-xl border border-rose-300 bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 cursor-pointer"
                          >
                            Tạm ngưng
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setServerError(null);
                            setSelectedId(t.id);
                          }}
                          className="rounded-xl border border-teal-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-900 shadow-2xs transition hover:bg-teal-50 cursor-pointer"
                        >
                          {t.status === 'PENDING_REVIEW' || t.status === 'APPROVED' ? 'Xem & xử lý' : 'Xem chi tiết'}
                        </button>
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
                    className="group rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
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
                        {t.status === 'APPROVED' && canSuspend && (
                          <button
                            type="button"
                            onClick={() => {
                              setServerError(null);
                              setQuickActionTour({ id: t.id, action: 'suspend', title: t.title });
                            }}
                            className="rounded-xl border border-rose-300 bg-rose-100 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200 cursor-pointer"
                          >
                            Tạm ngưng
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setServerError(null);
                            setSelectedId(t.id);
                          }}
                          className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100/80 cursor-pointer"
                        >
                          {t.status === 'PENDING_REVIEW' || t.status === 'APPROVED' ? 'Xem & xử lý' : 'Xem chi tiết'}
                        </button>
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

      {/* Decision Dialog Modal */}
      <DecisionDialog
        open={Boolean(selected)}
        title="Chi tiết tour"
        reasonLabel={reasonLabel}
        actions={actions}
        isSubmitting={isValidating || isSuspending}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TOUR_STATUS_LABELS[selected.status].className}`}>{TOUR_STATUS_LABELS[selected.status].label}</span>
              <span className="text-slate-600">{selected.agency?.name ?? 'Không rõ agency'}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{selected.title}</h3>
            <p className="text-xs text-slate-500">
              {selected.destination} · {selected.durationDays} ngày · {money.format(selected.basePrice)}
              {selected.submittedAt ? ` · Gửi duyệt ${formatTourDate(selected.submittedAt)}` : ''}
            </p>
            {selected.description || selected.summary ? (
              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{selected.description || selected.summary}</p>
            ) : null}
            {selected.itinerary && selected.itinerary.length > 0 && (
              <ol className="list-none space-y-1 pl-0 text-slate-700">
                {selected.itinerary.map((d, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="font-semibold text-slate-800 shrink-0">
                      {d.toDay && d.toDay > d.day ? `Ngày ${d.day} – ${d.toDay}:` : `Ngày ${d.day}:`}
                    </span>
                    <span>{d.title}</span>
                  </li>
                ))}
              </ol>
            )}
            {selected.statusReason && (
              <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-900">
                <span className="font-bold">Lý do gần nhất:</span> {selected.statusReason}
              </p>
            )}
          </>
        )}
      </DecisionDialog>

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
