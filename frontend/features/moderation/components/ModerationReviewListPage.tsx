'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, Compass, Eye, EyeOff, LayoutGrid, List, RefreshCw, User, X } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination, AntSelect, type AntSelectOption } from '@/components/ui';
import { RatingStars } from '@/features/review/components';
import { useBanAccountMutation, useGetModerationReviewsQuery, useModerateReviewMutation } from '../api/moderationApi';
import { PERMISSION, REVIEW_STATUS_LABELS } from '../labels';
import type { ModerationReview, ReviewStatus } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ReviewStatus;

interface Props {
  hideTitle?: boolean;
}

/** Formats review date: "18:03 1/11", or "18:03 1/11/2026" if another year */
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

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetModerationReviewsQuery(
    { page, limit: PAGE_SIZE, ...(filter === 'ALL' ? {} : { status: filter }) },
    { skip: !canModerate },
  );
  const [moderateReview, { isLoading: isModerating }] = useModerateReviewMutation();
  const [banAccount, { isLoading: isBanning }] = useBanAccountMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<'moderate' | 'ban'>('moderate');
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canModerate) return <ModerationDenied />;

  // Always read the open review from the cache so the dialog reflects what the backend returned.
  const selected: ModerationReview | null = data?.items.find((r) => r.id === selectedId) ?? null;

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
  if (selected && canBan) {
    const banAction: DecisionAction = {
      key: 'ban',
      label: 'Khoá tài khoản tác giả',
      tone: 'negative',
      requiresReason: true,
      onConfirm: (reason) =>
        void decide(
          () => banAccount({ id: selected.travelerId, reason }).unwrap(),
          'Đã khoá tài khoản vi phạm.',
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
    // The review author can also be banned from the moderation view if needed
    if (selected && canBan) {
      actions.push({
        key: 'ban',
        label: 'Khoá tài khoản tác giả',
        tone: 'negative',
        requiresReason: true,
        onConfirm: (reason) =>
          void decide(
            () => banAccount({ id: selected.travelerId, reason }).unwrap(),
            'Đã khoá tài khoản vi phạm.',
            'Không thể khoá tài khoản này. Vui lòng kiểm tra lại quyền và trạng thái tài khoản.',
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
    ...(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => ({
      value: s,
      label: REVIEW_STATUS_LABELS[s].label,
    })),
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header / Toolbar */}
      <header className={`flex flex-wrap items-center justify-between gap-3 ${hideTitle ? '' : 'border-b border-slate-100 pb-5'}`}>
        {!hideTitle && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Kiểm duyệt đánh giá</h1>
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-2.5 ${hideTitle ? 'w-full justify-end' : ''}`}>
          <AntSelect<StatusFilter>
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(val) => {
              setFilter(val);
              setPage(1);
            }}
            options={reviewStatusOptions}
            size="middle"
            className="min-w-[175px]"
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
        <LoadingState label="Đang tải danh sách đánh giá..." />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách đánh giá" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có đánh giá nào" description="Không có đánh giá nào khớp với bộ lọc hiện tại." />
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'grid' ? (
            /* Grid View: 2 columns, spacious and uncrowded */
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.items.map((r) => {
                const isVisible = r.status === 'VISIBLE';
                const cardStyle = isVisible
                  ? 'border-teal-200/90 bg-teal-50/25 hover:border-teal-300'
                  : 'border-slate-300 bg-slate-100/70 hover:border-slate-400';
                const primaryImage = (r.images && r.images.length > 0) ? r.images[0] : (r.tourImage || '/images/destination-ninh-binh.png');

                return (
                  <li
                    key={r.id}
                    className={`flex flex-col justify-between rounded-3xl border ${cardStyle} p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all`}
                  >
                    <div>
                      {/* Top Row: Tour Pill + Action Icons */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 border border-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-800 max-w-[70%]">
                          <Compass className="size-3.5 text-brand-teal shrink-0" />
                          <span className="truncate" title={r.tourTitle}>{r.tourTitle}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Nút ẩn / khôi phục */}
                          <button
                            type="button"
                            onClick={() => {
                              setServerError(null);
                              setSelectedId(r.id);
                              setDialogAction('moderate');
                            }}
                            title={isVisible ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}
                            aria-label="Xem & xử lý"
                            className={`flex size-8 items-center justify-center rounded-xl border transition shadow-2xs cursor-pointer ${
                              isVisible
                                ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200'
                            }`}
                          >
                            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            <span className="sr-only">Xem &amp; xử lý</span>
                          </button>

                          {/* Nút khoá tài khoản */}
                          {canBan && (
                            <button
                              type="button"
                              onClick={() => {
                                setServerError(null);
                                setSelectedId(r.id);
                                setDialogAction('ban');
                              }}
                              title="Khoá tài khoản tác giả"
                              aria-label="Khoá tài khoản tác giả"
                              className="flex size-8 items-center justify-center rounded-xl border border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 transition shadow-2xs cursor-pointer"
                            >
                              <Ban className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tour Image Banner */}
                      <div className="relative mt-3.5 mb-3.5 h-44 w-full overflow-hidden rounded-2xl bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={primaryImage}
                          alt={r.tourTitle}
                          className="size-full object-cover transition-transform duration-300 hover:scale-105 cursor-pointer"
                          onClick={() => setLightboxImage(primaryImage)}
                        />
                        {/* Stars Overlay */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-xl bg-slate-950/65 backdrop-blur-xs px-2.5 py-1 text-white text-xs font-bold shadow-xs">
                          <RatingStars value={r.rating} size="sm" />
                          <span>{r.rating}.0</span>
                        </div>
                        {r.images && r.images.length > 1 && (
                          <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-slate-950/70 backdrop-blur-xs px-2 py-0.5 text-white text-[10px] font-bold">
                            +{r.images.length} ảnh
                          </div>
                        )}
                      </div>

                      {/* Author info */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 text-xs">
                          {r.travelerName ? r.travelerName.slice(0, 2).toUpperCase() : <User className="size-4 text-teal-700" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{r.travelerName || 'Khách du lịch'}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">{formatReviewDate(r.createdAt)}</p>
                        </div>
                      </div>

                      {/* Comment */}
                      <div className="mt-3">
                        <p className="text-sm text-slate-800 leading-relaxed rounded-2xl bg-white/75 p-3.5 border border-slate-200/60 line-clamp-4">
                          &ldquo;{r.comment}&rdquo;
                        </p>
                      </div>

                      {/* Extra guest photos if any */}
                      {r.images && r.images.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {r.images.slice(1, 5).map((img, idx) => (
                            <button
                              key={`${img}-${idx}`}
                              type="button"
                              onClick={() => setLightboxImage(img)}
                              className="size-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:scale-105 transition cursor-zoom-in"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Ảnh review ${idx + 2}`} className="size-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Hidden Notice */}
                      {r.hiddenReason && (
                        <div className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                          <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="truncate"><span className="font-bold">Ẩn:</span> {r.hiddenReason}</div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            /* List View: Exactly matches user's hand-drawn wireframe */
            <ul className="space-y-4">
              {data.items.map((r) => {
                const isVisible = r.status === 'VISIBLE';
                const cardStyle = isVisible
                  ? 'border-teal-200/90 bg-teal-50/25 hover:border-teal-300'
                  : 'border-slate-300 bg-slate-100/70 hover:border-slate-400';
                const primaryImage = (r.images && r.images.length > 0) ? r.images[0] : (r.tourImage || '/images/destination-ninh-binh.png');

                return (
                  <li
                    key={r.id}
                    className={`rounded-3xl border ${cardStyle} p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all`}
                  >
                    {/* Top Row: Tour Pill on Left + Action Icons on Right */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-800 max-w-[70%] sm:max-w-[80%]">
                        <Compass className="size-3.5 text-brand-teal shrink-0" />
                        <span className="truncate" title={r.tourTitle}>{r.tourTitle}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Nút ẩn / khôi phục */}
                        <button
                          type="button"
                          onClick={() => {
                            setServerError(null);
                            setSelectedId(r.id);
                            setDialogAction('moderate');
                          }}
                          title={isVisible ? 'Ẩn đánh giá' : 'Khôi phục đánh giá'}
                          aria-label="Xem & xử lý"
                          className={`flex size-8 sm:size-9 items-center justify-center rounded-xl border transition shadow-2xs cursor-pointer ${
                            isVisible
                              ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200'
                          }`}
                        >
                          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          <span className="sr-only">Xem &amp; xử lý</span>
                        </button>

                        {/* Nút khoá tài khoản */}
                        {canBan && (
                          <button
                            type="button"
                            onClick={() => {
                              setServerError(null);
                              setSelectedId(r.id);
                              setDialogAction('ban');
                            }}
                            title="Khoá tài khoản tác giả"
                            aria-label="Khoá tài khoản tác giả"
                            className="flex size-8 sm:size-9 items-center justify-center rounded-xl border border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 transition shadow-2xs cursor-pointer"
                          >
                            <Ban className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Row: Tour Photo on Left, Info + Rating + Comment on Right */}
                    <div className="mt-3.5 flex flex-col sm:flex-row items-start gap-4">
                      {/* Tour Image */}
                      <div
                        className="relative size-24 sm:size-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs hover:scale-105 transition cursor-pointer"
                        onClick={() => setLightboxImage(primaryImage)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={primaryImage}
                          alt={r.tourTitle}
                          className="size-full object-cover"
                        />
                        {r.images && r.images.length > 1 && (
                          <span className="absolute bottom-1 right-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            +{r.images.length}
                          </span>
                        )}
                      </div>

                      {/* Right Details */}
                      <div className="flex-1 min-w-0">
                        {/* Avatar + Name + Date */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 text-xs">
                            {r.travelerName ? r.travelerName.slice(0, 2).toUpperCase() : <User className="size-4 text-teal-700" />}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm truncate">{r.travelerName || 'Khách du lịch'}</h4>
                          <span className="text-xs text-slate-400 font-medium">{formatReviewDate(r.createdAt)}</span>
                        </div>

                        {/* Stars */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <RatingStars value={r.rating} size="sm" />
                          <span className="font-extrabold text-amber-900 text-xs">{r.rating}.0 / 5</span>
                        </div>

                        {/* Comment in Quotes */}
                        <p className="mt-2 text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap rounded-2xl bg-white/75 p-3.5 border border-slate-200/60 shadow-2xs">
                          &ldquo;{r.comment}&rdquo;
                        </p>

                        {/* Guest Photos Strip */}
                        {r.images && r.images.length > 1 && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {r.images.slice(1, 5).map((img, idx) => (
                              <button
                                key={`${img}-${idx}`}
                                type="button"
                                onClick={() => setLightboxImage(img)}
                                aria-label={`Xem ảnh đánh giá ${idx + 2}`}
                                className="size-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:scale-105 transition cursor-zoom-in"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={`Ảnh review ${idx + 2}`} className="size-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Hidden Notice */}
                        {r.hiddenReason && (
                          <div className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                            <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="truncate"><span className="font-bold">Ẩn:</span> {r.hiddenReason}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="đánh giá" />
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

      <DecisionDialog
        open={Boolean(selected)}
        title={dialogTitle}
        reasonLabel={reasonLabel}
        actions={actions}
        isSubmitting={isModerating || isBanning}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            {dialogAction === 'ban' ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900">
                <p className="font-bold text-sm sm:text-base text-rose-900">
                  Bạn có chắc chắn muốn khoá tài khoản của tác giả này không?
                </p>
                <p className="mt-2 text-xs text-rose-800 leading-relaxed">
                  Tác giả: <strong className="text-slate-900">{selected.travelerName || 'Không xác định'}</strong>
                  {selected.agencyName && (
                    <> · Đối tác: <strong className="text-slate-900">{selected.agencyName}</strong></>
                  )}
                  {' '}· Tour: <strong className="text-slate-900">{selected.tourTitle}</strong>
                </p>
                <p className="mt-2 text-xs text-rose-600/90 italic">
                  * Tài khoản sau khi bị khoá sẽ không thể đăng nhập hoặc thực hiện thao tác trên hệ thống.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars value={selected.rating} size="sm" />
                    <span className="font-bold text-slate-900 text-sm">{selected.travelerName || 'Khách du lịch'}</span>
                    <span className="text-xs text-slate-500">· {selected.tourTitle}</span>
                    {selected.agencyName && (
                      <span className="text-xs text-slate-500">
                        (<span>{selected.agencyName}</span>)
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 italic bg-white rounded-xl p-3 border border-slate-200/60 leading-relaxed">
                    &ldquo;{selected.comment}&rdquo;
                  </p>
                  {selected.images && selected.images.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {selected.images.map((img, idx) => (
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
                {selected.hiddenReason && (
                  <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900">
                    <span className="font-bold">Lý do ẩn trước đó:</span> {selected.hiddenReason}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
