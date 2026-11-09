'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination, AntSelect, type AntSelectOption } from '@/components/ui';
import { RatingStars } from '@/features/review/components';
import { useBanAccountMutation, useGetModerationReviewsQuery, useModerateReviewMutation } from '../api/moderationApi';
import { PERMISSION, REVIEW_STATUS_LABELS } from '../labels';
import type { ModerationReview, ReviewStatus } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';
import { ReviewModerationQueue } from './ReviewModerationQueue';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ReviewStatus;
type StarFilter = 'ALL' | '5' | '4' | '3' | '2' | '1';

interface Props {
  hideTitle?: boolean;
}

/** Formats review date: "18:03 1/11", or "18:03 1/11/26" if another year */
export function formatReviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const time = `${hours}:${minutes}`;
  if (d.getFullYear() !== now.getFullYear()) {
    const yearShort = String(d.getFullYear()).slice(-2);
    return `${time} ${day}/${month}/${yearShort}`;
  }
  return `${time} ${day}/${month}`;
}

/** Use case "Moderate reviews": hide a violating review (with a reason) or restore it. */
export function ModerationReviewListPage({ hideTitle = false }: Props = {}) {
  const canModerate = useModerationPermission(PERMISSION.reviewModerate);
  const canBan = useModerationPermission(PERMISSION.accountBan);

  const [activeTab, setActiveTab] = useState<'ALL' | 'REPORTED'>('ALL');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [starFilter, setStarFilter] = useState<StarFilter>('ALL');
  const [search, setSearch] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetModerationReviewsQuery(
    { page, limit: PAGE_SIZE, ...(filter === 'ALL' ? {} : { status: filter }) },
    { skip: !canModerate },
  );

  const reportedCount = useMemo(() => {
    return (
      data?.items.filter(
        (r) =>
          Boolean((r as unknown as { isReported?: boolean }).isReported) ||
          ((r as unknown as { reportCount?: number }).reportCount ?? 0) > 0,
      ).length ?? 0
    );
  }, [data?.items]);

  const [moderateReview, { isLoading: isModerating }] = useModerateReviewMutation();
  const [banAccount, { isLoading: isBanning }] = useBanAccountMutation();

  const [banDuration, setBanDuration] = useState('7 ngày');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<'moderate' | 'ban'>('moderate');
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canModerate) return <ModerationDenied />;

  const selected: ModerationReview | null = data?.items.find((r) => r.id === selectedId) ?? null;

  const close = () => {
    setSelectedId(null);
    setServerError(null);
  };

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
  if (selected && canBan) {
    const banAction: DecisionAction = {
      key: 'ban',
      label: 'Khoá',
      tone: 'negative',
      requiresReason: false,
      hideIcon: true,
      onConfirm: () =>
        void decide(
          async () => {
            await banAccount({
              id: selected.travelerId,
              reason: `Khoá ${banDuration}: Tài khoản vi phạm quy định kiểm duyệt`,
            }).unwrap();
            if (selected.status === 'VISIBLE') {
              try {
                await moderateReview({
                  id: selected.id,
                  contentVersion: selected.contentVersion,
                  hide: true,
                  reason: `Tài khoản đã bị khoá ${banDuration}`,
                }).unwrap();
              } catch {
                // review may already be hidden or conflicted
              }
            }
            void refetch();
          },
          `Đã khoá tài khoản (${banDuration}) và ẩn đánh giá vi phạm.`,
          'Không thể khoá tài khoản này. Vui lòng kiểm tra lại quyền và trạng thái tài khoản.',
        ),
    };
    if (dialogAction === 'ban') {
      actions.push(banAction);
    }
  }

  if (dialogAction === 'moderate') {
    if (selected?.status === 'VISIBLE') {
      actions.push({
        key: 'hide',
        label: 'Ẩn đánh giá',
        tone: 'negative',
        requiresReason: true,
        onConfirm: (reason) =>
          void decide(
            () => moderateReview({ id: selected.id, contentVersion: selected.contentVersion, hide: true, reason }).unwrap(),
            'Đã ẩn đánh giá và cập nhật điểm của tour.',
            'Không thể ẩn đánh giá lúc này. Vui lòng thử lại.',
          ),
      });
    }
    if (selected?.status === 'HIDDEN') {
      actions.push({
        key: 'restore',
        label: 'Khôi phục đánh giá',
        tone: 'positive',
        requiresReason: true,
        onConfirm: (restorationReason) =>
          void decide(
            () => moderateReview({ id: selected.id, contentVersion: selected.contentVersion, hide: false, restorationReason }).unwrap(),
            'Đã khôi phục đánh giá và cập nhật điểm của tour.',
            'Không thể khôi phục đánh giá lúc này. Vui lòng thử lại.',
          ),
      });
    }
  }

  const dialogTitle =
    dialogAction === 'ban'
      ? 'Xác nhận khoá tài khoản'
      : 'Xác nhận xử lý đánh giá';

  const reasonLabel =
    dialogAction === 'ban'
      ? 'Lý do khoá tài khoản (bắt buộc)'
      : selected?.status === 'HIDDEN'
        ? 'Lý do khôi phục đánh giá (bắt buộc)'
        : 'Lý do ẩn đánh giá (bắt buộc)';

  const reviewStatusOptions: AntSelectOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'VISIBLE', label: 'Đang hiển thị' },
    { value: 'HIDDEN', label: 'Đã ẩn' },
  ];

  const starOptions: AntSelectOption<StarFilter>[] = [
    { value: 'ALL', label: 'Tất cả số sao' },
    { value: '5', label: '5 sao' },
    { value: '4', label: '4 sao' },
    { value: '3', label: '3 sao' },
    { value: '2', label: '2 sao' },
    { value: '1', label: '1 sao' },
  ];

  // Client-side search and star filter over page items
  const filteredItems = useMemo(() => {
    let items = data?.items ?? [];
    if (starFilter !== 'ALL') {
      const s = Number(starFilter);
      items = items.filter((r) => Math.round(r.rating) === s);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (r) =>
          r.comment.toLowerCase().includes(q) ||
          (r.travelerName && r.travelerName.toLowerCase().includes(q)) ||
          r.tourTitle.toLowerCase().includes(q),
      );
    }
    return items;
  }, [data?.items, starFilter, search]);

  const [collapsedTours, setCollapsedTours] = useState<Record<string, boolean>>({});

  const toggleTourCollapse = (tourTitle: string) => {
    setCollapsedTours((prev) => ({
      ...prev,
      [tourTitle]: !prev[tourTitle],
    }));
  };

  // Group filtered reviews by tour
  const tourGroups = useMemo(() => {
    const map = new Map<string, { tourTitle: string; tourImage?: string; reviews: ModerationReview[] }>();
    for (const r of filteredItems) {
      const existing = map.get(r.tourTitle);
      if (existing) {
        existing.reviews.push(r);
        if (!existing.tourImage && r.tourImage) {
          existing.tourImage = r.tourImage;
        }
      } else {
        map.set(r.tourTitle, {
          tourTitle: r.tourTitle,
          tourImage: r.tourImage,
          reviews: [r],
        });
      }
    }
    return Array.from(map.values());
  }, [filteredItems]);

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Top Header Row: Title on Left, Refresh Button on Right (Cùng hàng) */}
      <header className="flex items-center justify-between border-b border-slate-100 pb-4">
        {!hideTitle ? (
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Kiểm duyệt đánh giá
          </h1>
        ) : (
          <div />
        )}

        <button
          type="button"
          disabled={isFetching}
          onClick={handleRefresh}
          aria-label="Làm mới"
          title="Làm mới"
          className="flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* 2. Navigation Tabs (Image 2 style) */}
      <div className="flex items-center gap-6 border-b border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tất cả đánh giá
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('REPORTED')}
          className={`flex items-center gap-1.5 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'REPORTED'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Bị báo cáo</span>
          {reportedCount > 0 && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white leading-none">
              {reportedCount}
            </span>
          )}
        </button>
      </div>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Render Reported Reviews Queue tab */}
      {activeTab === 'REPORTED' ? (
        <ReviewModerationQueue hideTitle />
      ) : (
        /* Render All Reviews List tab */
        <div className="space-y-4">
          {/* 3. Filter Toolbar: Expandable Search + Status Dropdown + Star Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Smooth Expandable Search */}
            <div
              className={`relative flex h-10 items-center transition-all duration-300 ease-out ${
                isSearchExpanded || search ? 'w-full sm:w-80' : 'w-10'
              }`}
            >
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Tìm theo tên hoặc nội dung"
                placeholder="Tìm theo tên hoặc nội dung..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchExpanded(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
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
                      setIsSearchExpanded(false);
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
                  aria-label="Tìm kiếm theo tên hoặc nội dung"
                  title="Tìm kiếm theo tên hoặc nội dung"
                  className="absolute inset-0 flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-brand-teal active:scale-95 cursor-pointer"
                >
                  <Search className="size-4 transition-transform duration-200 group-hover:scale-110" />
                </button>
              )}
            </div>

            {/* AntSelect: Lọc theo trạng thái */}
            <AntSelect<StatusFilter>
              aria-label="Lọc theo trạng thái"
              value={filter}
              onChange={(val) => {
                setFilter(val);
                setPage(1);
              }}
              options={reviewStatusOptions}
              size="middle"
              className="min-w-[170px]"
              triggerClassName={filter !== 'ALL' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
            />

            {/* AntSelect: Lọc theo số sao */}
            <AntSelect<StarFilter>
              aria-label="Lọc theo số sao"
              value={starFilter}
              onChange={(val) => setStarFilter(val)}
              options={starOptions}
              size="middle"
              className="min-w-[155px]"
              triggerClassName={starFilter !== 'ALL' ? 'border-brand-teal/60 bg-teal-50/20 text-teal-900 font-semibold' : ''}
            />
          </div>

          {/* 4. Review Content */}
          {isLoading ? (
            <LoadingState label="Đang tải danh sách đánh giá..." />
          ) : isError ? (
            <ErrorState
              title="Không thể tải danh sách đánh giá"
              message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
              onAction={() => void refetch()}
            />
          ) : !data || filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
              <EmptyState title="Không có đánh giá nào" description="Không có đánh giá nào khớp với bộ lọc hiện tại." />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Reviews grouped by Tour in clean single outer container with thin divider lines */}
              {tourGroups.map((group) => {
                const isCollapsed = Boolean(collapsedTours[group.tourTitle]);

                return (
                  <div
                    key={group.tourTitle}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs divide-y divide-slate-100"
                  >
                    {/* Tour Banner Header with Image and Dropdown Toggle */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleTourCollapse(group.tourTitle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleTourCollapse(group.tourTitle);
                        }
                      }}
                      aria-expanded={!isCollapsed}
                      className="flex items-center justify-between gap-3 bg-slate-100/90 px-4 py-3 border-b border-slate-200/80 hover:bg-slate-200/70 transition cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {group.tourImage ? (
                          <img
                            src={group.tourImage}
                            alt={group.tourTitle}
                            className="size-9 rounded-xl object-cover shrink-0 border border-slate-200 shadow-2xs"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-600 text-white shrink-0 shadow-2xs font-bold text-xs">
                            <Compass className="size-5" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-md bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white tracking-wide uppercase">
                            Tour
                          </span>
                          <h3 className="font-bold text-sm text-slate-900 truncate" title={group.tourTitle}>
                            {group.tourTitle}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-slate-500">
                        <ChevronDown
                          className={`size-4.5 transition-transform duration-200 ${
                            isCollapsed ? '-rotate-90' : 'rotate-0'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Reviews inside Tour */}
                    {!isCollapsed &&
                      group.reviews.map((r) => {
                        const isVisible = r.status === 'VISIBLE';

                        return (
                          <div
                            key={r.id}
                            className="flex items-start gap-3.5 p-4 sm:p-5 hover:bg-slate-50/50 transition-colors"
                          >
                            {/* Circle Avatar */}
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800 text-xs shadow-2xs">
                              {r.travelerName ? r.travelerName.slice(0, 2).toUpperCase() : <User className="size-4 text-sky-700" />}
                            </div>

                            {/* Review Content */}
                            <div className="flex-1 min-w-0">
                              {/* Top Row: Name + Stars + Date + Status Badge + Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {r.travelerName || 'Khách du lịch'}
                                  </span>
                                  <RatingStars value={r.rating} size="sm" />
                                  <span className="text-xs text-slate-400 font-medium">
                                    {formatReviewDate(r.createdAt)}
                                  </span>

                                  {/* Badge chữ (Hiển thị xanh, Đã ẩn vàng) */}
                                  {isVisible ? (
                                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                                      Hiển thị
                                    </span>
                                  ) : (
                                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60">
                                      Đã ẩn
                                    </span>
                                  )}
                                </div>

                                {/* Action Buttons on Right */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Nút Ẩn / Hiện có nhãn chữ */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setServerError(null);
                                      setSelectedId(r.id);
                                      setDialogAction('moderate');
                                    }}
                                    title={isVisible ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}
                                    aria-label="Xem & xử lý"
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                                  >
                                    {isVisible ? (
                                      <EyeOff className="size-3.5 text-slate-500" />
                                    ) : (
                                      <Eye className="size-3.5 text-slate-500" />
                                    )}
                                    <span>{isVisible ? 'Ẩn' : 'Hiện'}</span>
                                    <span className="sr-only">Xem &amp; xử lý</span>
                                  </button>

                                  {/* Nút Khoá: chỉ chữ Khoá, không icon, không từ tác giả */}
                                  {canBan && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setServerError(null);
                                        setSelectedId(r.id);
                                        setDialogAction('ban');
                                      }}
                                      title="Khoá tài khoản"
                                      aria-label="Khoá tài khoản"
                                      className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-100 hover:border-rose-300 transition cursor-pointer"
                                    >
                                      Khoá
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Comment Body */}
                              <p className="mt-1.5 text-sm text-slate-800 leading-relaxed font-normal">
                                {r.comment}
                              </p>

                              {/* Lý do ẩn: nằm dưới nội dung, chữ nhỏ màu xám */}
                              {r.hiddenReason && (
                                <p className="mt-1 text-xs text-slate-400 font-normal">
                                  Lý do ẩn: {r.hiddenReason}
                                </p>
                              )}

                              {/* Guest Photos Strip if any */}
                              {r.images && r.images.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  {r.images.map((img, idx) => (
                                    <button
                                      key={`${img}-${idx}`}
                                      type="button"
                                      onClick={() => setLightboxImage(img)}
                                      className="size-14 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:scale-105 transition cursor-zoom-in"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={img} alt={`Ảnh review ${idx + 1}`} className="size-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}

              <Pagination
                currentPage={data.meta.page}
                totalPages={data.meta.totalPages}
                totalItems={data.meta.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                disabled={isFetching}
                showInfo
                itemLabel="đánh giá"
              />
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-label="Xem ảnh phóng to"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Đóng ảnh"
              className="absolute -top-3 -right-3 rounded-full bg-slate-900/90 p-2 text-white hover:bg-slate-800 shadow-lg transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage}
              alt="Ảnh đánh giá phóng to"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Decision Dialog Modal */}
      <DecisionDialog
        open={Boolean(selected)}
        title={dialogTitle}
        reasonLabel={reasonLabel}
        hideReasonInput={dialogAction === 'ban'}
        actions={actions}
        isSubmitting={isModerating || isBanning}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            {dialogAction === 'ban' ? (
              <div className="space-y-4">
                <p className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                  Bạn có chắc chắn muốn khoá tài khoản của &ldquo;{selected.travelerName || 'người dùng'}&rdquo; không?
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Thời hạn khoá tài khoản:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['1 ngày', '7 ngày', '30 ngày', 'Vĩnh viễn'].map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        onClick={() => setBanDuration(duration)}
                        className={`rounded-xl py-2 px-3 text-xs font-bold transition border cursor-pointer text-center ${
                          banDuration === duration
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {duration}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                  {selected.status === 'HIDDEN'
                    ? `Bạn có muốn khôi phục đánh giá của "${selected.travelerName || 'người dùng'}" không?`
                    : `Bạn có muốn ẩn đánh giá của "${selected.travelerName || 'người dùng'}" khỏi tour không?`}
                </p>
                {selected.status === 'HIDDEN' && selected.hiddenReason && (
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Lý do ẩn trước đó:</span> {selected.hiddenReason}
                  </p>
                )}
                {selected.agencyName && (
                  <span className="sr-only">{selected.agencyName}</span>
                )}
              </div>
            )}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
