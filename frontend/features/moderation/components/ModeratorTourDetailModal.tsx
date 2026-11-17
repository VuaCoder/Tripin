'use client';

import { useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Luggage,
  MapPin,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { formatVnd } from '@/lib/travel-format';
import { useGetModerationTourQuery } from '../api/moderationApi';
import { REASON_MAX, TOUR_STATUS_LABELS, validateReason } from '../labels';
import type { ModerationTour, ModerationTourStatus } from '../types';
import { formatTourDate } from './ModerationTourListPage';
import { money } from './ModerationUi';

interface Props {
  tourId: string;
  initialTour?: ModerationTour;
  canValidate: boolean;
  canSuspend: boolean;
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onApprove: (reason?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onSuspend: (reason: string) => Promise<void>;
}

type TabType = 'overview' | 'itinerary' | 'pricing' | 'services' | 'policies';

export function ModeratorTourDetailModal({
  tourId,
  initialTour,
  canValidate,
  canSuspend,
  isSubmitting,
  serverError,
  onClose,
  onApprove,
  onReject,
  onSuspend,
}: Props) {
  const { data: tourDetail, isLoading } = useGetModerationTourQuery(tourId);
  const tour = tourDetail ?? initialTour;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ action: 'approve' | 'reject' | 'suspend'; reason: string } | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const status: ModerationTourStatus = tour?.status ?? 'PENDING_REVIEW';
  const statusMeta = TOUR_STATUS_LABELS[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };

  const canApproveOrReject = status === 'PENDING_REVIEW' && canValidate;
  const canPerformSuspend = status === 'APPROVED' && canSuspend;

  const handleAction = async (action: 'approve' | 'reject' | 'suspend') => {
    if (isSubmitting) return;

    if (action === 'reject' || action === 'suspend') {
      const err = validateReason(reason);
      setValidationError(err);
      if (err) {
        reasonRef.current?.focus();
        return;
      }
    } else {
      setValidationError(null);
    }

    setPendingAction({ action, reason: reason.trim() });
  };

  const confirmAction = async () => {
    if (!pendingAction || isSubmitting) return;
    if (pendingAction.action === 'approve') await onApprove(pendingAction.reason || undefined);
    else if (pendingAction.action === 'reject') await onReject(pendingAction.reason);
    else await onSuspend(pendingAction.reason);
  };

  const actionLabel = pendingAction?.action === 'approve' ? 'duyệt tour' : pendingAction?.action === 'reject' ? 'từ chối' : 'tạm ngưng tour';

  const images: string[] = [];
  if (tour?.coverImage) images.push(tour.coverImage);
  if (tour?.images?.length) {
    for (const img of tour.images) {
      if (!images.includes(img)) images.push(img);
    }
  }

  const selectedImage = images[activeImageIdx] || images[0];

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Tổng quan & Hình ảnh' },
    { id: 'itinerary', label: 'Lịch trình', count: tourDetail?.itinerary?.length },
    { id: 'pricing', label: 'Giá vé & Sức chứa', count: tourDetail?.departures?.length },
    { id: 'services', label: 'Dịch vụ đi kèm' },
    { id: 'policies', label: 'Chính sách & Hướng dẫn' },
  ];

  return (
    <>
    <Modal
      open={!pendingAction}
      onClose={onClose}
      closeOnBackdrop={!isSubmitting}
      title="Chi tiết kiểm duyệt tour"
      className="max-w-6xl w-[96vw]"
      contentClassName="!p-0"
      footerScrollable
      footer={
        <div className="w-full space-y-3.5">
          {/* Previous Rejection or Suspension Reason */}
          {tour?.statusReason && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/95 p-3.5 text-sm text-amber-900 shadow-2xs">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-bold text-amber-950">Lý do xử lý gần nhất:</strong> {tour.statusReason}
              </div>
            </div>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700 shadow-2xs">
              <AlertOctagon className="size-5 shrink-0 text-rose-600" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Reason Input Box when actions can be taken */}
          {(canApproveOrReject || canPerformSuspend) && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="moderator-tour-reason" className="font-bold text-slate-800">
                  {canPerformSuspend
                    ? 'Lý do tạm ngưng (bắt buộc, 3–1000 ký tự)'
                    : 'Lý do (bắt buộc khi từ chối, tùy chọn khi duyệt)'}
                </label>
                <span className={`text-xs ${reason.length > REASON_MAX ? 'font-bold text-rose-600' : 'text-slate-400'}`}>
                  {reason.length}/{REASON_MAX} ký tự
                </span>
              </div>
              <textarea
                ref={reasonRef}
                id="moderator-tour-reason"
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isSubmitting}
                placeholder={
                  canPerformSuspend
                    ? 'Nhập lý do tạm ngưng tour để thông báo đến Agency...'
                    : 'Nhập lý do từ chối (bắt buộc) hoặc ghi chú duyệt tour gửi cho Agency...'
                }
                className={`w-full rounded-2xl border p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                  validationError
                    ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-300 bg-white focus:border-brand-teal focus:ring-brand-teal/20'
                }`}
              />
              {validationError && <p className="text-xs font-semibold text-rose-600">{validationError}</p>}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              Đóng
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {canApproveOrReject && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleAction('reject')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50/90 px-5 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                    <span>Từ chối</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleAction('approve')}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    <span>{isSubmitting ? 'Đang duyệt...' : 'Duyệt tour'}</span>
                  </button>
                </>
              )}

              {canPerformSuspend && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleAction('suspend')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <AlertOctagon className="size-4" />}
                  <span>{isSubmitting ? 'Đang tạm ngưng...' : 'Tạm ngưng tour'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="border-b border-slate-200 bg-white">
        {/* Compact Header Banner */}
        <div className="bg-gradient-to-b from-slate-50/95 to-white px-5 py-3 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold shadow-2xs ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Building2 className="size-3.5 text-teal-600" />
                  <span>{tour?.agency?.name ?? 'Không rõ agency'}</span>
                </div>
                {tour?.submittedAt && (
                  <span className="text-xs text-slate-400">
                    • Gửi duyệt: {formatTourDate(tour.submittedAt)}
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                {tour?.title}
              </h3>
            </div>

            {/* Quick Metrics Badges: Compact Inline */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700 shrink-0">
              <span className="inline-flex items-center gap-1 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <MapPin className="size-3.5 text-teal-600 shrink-0" />
                <span>{tour?.destination}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <Clock className="size-3.5 text-teal-600 shrink-0" />
                <span>{tour?.durationDays} ngày</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <Users className="size-3.5 text-teal-600 shrink-0" />
                <span>{tourDetail?.maxGroupSize ? `Tối đa ${tourDetail.maxGroupSize} khách` : 'Quy mô tự do'}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-extrabold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs">
                <span>{tour?.basePrice ? money.format(tour.basePrice) : 'Chưa có giá'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Sleek & Compact */}
        <div className="flex overflow-x-auto border-t border-slate-100 bg-white px-5 sm:px-6 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'border-brand-teal text-brand-teal'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className={`rounded-full px-2 py-0.2 text-[11px] font-bold ${
                    isActive ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body: Natural single scroll driven by modal container */}
      <div className="bg-slate-50/70 p-5 sm:p-7 space-y-6">
        {isLoading && !tourDetail && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="size-9 animate-spin text-teal-600 mb-3" />
            <p className="text-sm font-medium text-slate-600">Đang tải toàn bộ thông tin chi tiết tour...</p>
          </div>
        )}

        {/* Tab 1: Tổng quan & Hình ảnh */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Gallery Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Thư viện hình ảnh ({images.length} ảnh)
              </h4>

              {images.length > 0 ? (
                <div className="space-y-3">
                  <div className="relative aspect-[16/9] max-h-80 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900/5">
                    <img
                      src={selectedImage}
                      alt={tour?.title || 'Ảnh tour'}
                      className="size-full object-cover transition duration-300"
                    />
                    <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
                      Ảnh {activeImageIdx + 1}/{images.length}
                    </div>
                  </div>

                  {images.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIdx(idx)}
                          className={`relative size-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                            activeImageIdx === idx ? 'border-brand-teal ring-2 ring-brand-teal/30 scale-102' : 'border-slate-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt={`Ảnh ${idx + 1}`} className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-sm">
                  Chưa tải ảnh thương hiệu hoặc thư viện ảnh.
                </div>
              )}
            </div>

            {/* Description & Summary Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Giới thiệu & Mô tả chi tiết
              </h4>

              {tour?.summary && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-950 font-medium leading-relaxed">
                  <strong className="text-teal-900 font-bold">Tóm tắt ngắn:</strong> {tour.summary}
                </div>
              )}

              {tour?.description ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {tour.description}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Chưa có mô tả chi tiết cho tour này.</p>
              )}
            </div>

            {/* Highlights Card */}
            {tourDetail?.highlights && tourDetail.highlights.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Điểm nổi bật của tour
                </h4>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {tourDetail.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm text-slate-800">
                      <Sparkles className="size-4 shrink-0 text-amber-500 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Meeting Point Card */}
            {tourDetail?.meetingPoint && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Điểm tập trung khởi hành
                </h4>
                <div className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/50 p-3.5 text-sm text-slate-800">
                  <MapPin className="size-4 shrink-0 text-teal-600" />
                  <span><strong className="font-semibold text-slate-900">Địa điểm:</strong> {tourDetail.meetingPoint}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Lịch trình chi tiết */}
        {activeTab === 'itinerary' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lịch trình từng ngày ({tourDetail?.itinerary?.length ?? 0} ngày)
            </h4>

            {tourDetail?.itinerary && tourDetail.itinerary.length > 0 ? (
              <ol className="relative border-l-2 border-teal-200 ml-4 space-y-6 pl-6">
                {[...tourDetail.itinerary]
                  .sort((a, b) => a.day - b.day)
                  .map((dayItem, idx) => (
                    <li key={idx} className="relative space-y-2.5">
                      {/* Timeline dot */}
                      <span className="absolute -left-[35px] top-0 flex size-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white ring-4 ring-white">
                        {dayItem.day}
                      </span>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-900">
                          {dayItem.toDay && dayItem.toDay > dayItem.day
                            ? `Ngày ${dayItem.day} – Ngày ${dayItem.toDay}`
                            : `Ngày ${dayItem.day}`}
                        </span>
                        <h5 className="text-base font-bold text-slate-900">{dayItem.title}</h5>
                      </div>

                      {dayItem.description && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                          {dayItem.description}
                        </p>
                      )}

                      {dayItem.activities && dayItem.activities.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Các hoạt động trong ngày:
                          </p>
                          <ul className="space-y-1.5 pl-1">
                            {dayItem.activities.map((act, actIdx) => (
                              <li key={actIdx} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="size-2 rounded-full bg-teal-500 mt-2 shrink-0" />
                                <span>{act}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
              </ol>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm">
                <Calendar className="size-9 stroke-[1.2] mb-2 text-slate-300" />
                <p>Chưa có thông tin lịch trình cho tour này.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Giá vé & Sức chứa */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            {/* Age Pricing Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Chính sách giá theo từng nhóm khách
              </h4>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Adult */}
                <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                    Người lớn (từ 13 tuổi)
                  </span>
                  <p className="text-xl sm:text-2xl font-extrabold text-teal-950">
                    {tour?.basePrice
                      ? money.format(tour.basePrice)
                      : 'Chưa đặt'}
                  </p>
                  <p className="text-xs text-slate-500">Giá vé tiêu chuẩn / người</p>
                </div>

                {/* Child */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Trẻ em (2 – 12 tuổi)
                  </span>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {typeof tourDetail?.agePricing?.childPrice === 'number'
                      ? tourDetail.agePricing.childPrice === 0
                        ? 'Miễn phí'
                        : money.format(tourDetail.agePricing.childPrice)
                      : typeof tourDetail?.agePricing?.childPercent === 'number'
                      ? `${tourDetail.agePricing.childPercent}% vé người lớn`
                      : 'Theo thỏa thuận'}
                  </p>
                  <p className="text-xs text-slate-500">Giá vé trẻ em / người</p>
                </div>

                {/* Infant */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Em bé (dưới 2 tuổi)
                  </span>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {typeof tourDetail?.agePricing?.infantPrice === 'number'
                      ? tourDetail.agePricing.infantPrice === 0
                        ? 'Miễn phí'
                        : money.format(tourDetail.agePricing.infantPrice)
                      : typeof tourDetail?.agePricing?.infantPercent === 'number'
                      ? `${tourDetail.agePricing.infantPercent}% vé người lớn`
                      : 'Miễn phí'}
                  </p>
                  <p className="text-xs text-slate-500">Giá vé em bé / người</p>
                </div>
              </div>

              {tourDetail?.childPricingPolicy && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <strong className="text-slate-900">Ghi chú chính sách trẻ em:</strong> {tourDetail.childPricingPolicy}
                </div>
              )}
            </div>

            {/* Departures Table Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Danh sách lịch khởi hành ({tourDetail?.departures?.length ?? 0} chuyến)
                </h4>
                <span className="text-sm text-slate-600">
                  Sức chứa đoàn tối đa: <strong className="text-slate-900">{tourDetail?.maxGroupSize ? `${tourDetail.maxGroupSize} khách` : 'Chưa giới hạn'}</strong>
                </span>
              </div>

              {tourDetail?.departures && tourDetail.departures.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                      <tr>
                        <th className="px-4 py-3.5">Ngày khởi hành</th>
                        <th className="px-3.5 py-3.5">Sức chứa (Slot)</th>
                        <th className="px-3.5 py-3.5">Đã đặt</th>
                        <th className="px-3.5 py-3.5">Còn trống</th>
                        <th className="px-3.5 py-3.5">Giá chuyến</th>
                        <th className="px-4 py-3.5 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {tourDetail.departures.map((dep) => (
                        <tr key={dep.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {dep.date.slice(0, 10)}
                          </td>
                          <td className="px-3.5 py-3.5 font-medium">{dep.capacity} chỗ</td>
                          <td className="px-3.5 py-3.5 text-slate-500">{dep.bookedCount ?? 0}</td>
                          <td className="px-3.5 py-3.5 font-bold text-teal-800">
                            {dep.remaining ?? dep.capacity} chỗ
                          </td>
                          <td className="px-3.5 py-3.5 font-medium">
                            {dep.priceOverride ? money.format(dep.priceOverride) : money.format(dep.price ?? tour!.basePrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                dep.isOpen !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {dep.isOpen !== false ? 'Đang mở' : 'Đã đóng'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-sm">
                  <Calendar className="size-7 text-slate-300 mb-1.5" />
                  <span>Agency chưa lên lịch khởi hành nào cho tour này.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Dịch vụ đi kèm */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Inclusions & Exclusions Card */}
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Inclusions */}
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                  <Check className="size-5 text-emerald-700" />
                  <span>Dịch vụ bao gồm ({tourDetail?.inclusions?.length ?? 0})</span>
                </div>
                {tourDetail?.inclusions && tourDetail.inclusions.length > 0 ? (
                  <ul className="space-y-2.5">
                    {tourDetail.inclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 italic">Chưa liệt kê dịch vụ bao gồm.</p>
                )}
              </div>

              {/* Exclusions */}
              <div className="rounded-2xl border border-rose-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-900">
                  <X className="size-5 text-rose-700" />
                  <span>Dịch vụ không bao gồm ({tourDetail?.exclusions?.length ?? 0})</span>
                </div>
                {tourDetail?.exclusions && tourDetail.exclusions.length > 0 ? (
                  <ul className="space-y-2.5">
                    {tourDetail.exclusions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <X className="size-4 text-rose-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 italic">Chưa liệt kê dịch vụ loại trừ.</p>
                )}
              </div>
            </div>

            {/* Optional Services Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Dịch vụ bán thêm / Tùy chọn ({tourDetail?.optionalServices?.length ?? 0})
              </h4>

              {tourDetail?.optionalServices && tourDetail.optionalServices.length > 0 ? (
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {tourDetail.optionalServices.map((service) => (
                    <div
                      key={service.id}
                      className={`rounded-2xl border p-4 space-y-2 transition ${
                        service.active !== false
                          ? 'border-slate-200 bg-white hover:border-teal-300'
                          : 'border-slate-100 bg-slate-50/70 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h5 className="text-sm font-bold text-slate-900 leading-snug">{service.name}</h5>
                        <span className="shrink-0 font-extrabold text-teal-800 text-sm">
                          {service.price ? formatVnd(service.price) : 'Miễn phí'}
                          <small className="block text-xs font-normal text-slate-500 text-right">
                            / {service.pricing === 'PER_PERSON' ? 'người' : service.pricing === 'PER_BOOKING' ? 'đoàn' : service.unit}
                          </small>
                        </span>
                      </div>

                      {service.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>
                      )}

                      {service.pickup?.area && (
                        <p className="text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg font-medium">
                          Khu vực đón: {service.pickup.area}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Không có dịch vụ tùy chọn bán thêm.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Chính sách & Hướng dẫn */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            {/* Cancellation Policy */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="size-4.5 text-teal-700" />
                <span>Chính sách hoàn hủy tour</span>
              </h4>
              {tourDetail?.cancellationPolicy ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {tourDetail.cancellationPolicy}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Chưa cấu hình chính sách hủy tour riêng.</p>
              )}
            </div>

            {/* Required Documents */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileCheck className="size-4.5 text-teal-700" />
                <span>Giấy tờ cần thiết khi đi tour</span>
              </h4>
              {tourDetail?.requiredDocuments ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {tourDetail.requiredDocuments}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Chưa cấu hình yêu cầu giấy tờ.</p>
              )}
            </div>

            {/* Travel Notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Luggage className="size-4.5 text-teal-700" />
                <span>Lưu ý trước chuyến đi</span>
              </h4>
              {tourDetail?.travelNotes ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {tourDetail.travelNotes}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Chưa có lưu ý chuyến đi.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
    <Modal
      open={Boolean(pendingAction)}
      onClose={() => { if (!isSubmitting) setPendingAction(null); }}
      closeOnBackdrop={!isSubmitting}
      title={`Xác nhận ${actionLabel}`}
      className="max-w-md"
    >
      {pendingAction && (
        <div className="space-y-5 text-sm">
          {serverError && <p role="alert" className="rounded-xl bg-rose-50 p-3 font-semibold text-rose-700">{serverError}</p>}
          <p>Bạn có chắc chắn muốn {actionLabel} "{tour?.title}" không?</p>
          {pendingAction.reason && <p className="rounded-xl bg-slate-50 p-3 text-slate-700">Lý do: {pendingAction.reason}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={isSubmitting} onClick={() => setPendingAction(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold">Hủy</button>
            <button type="button" disabled={isSubmitting} onClick={() => void confirmAction()} className="rounded-xl bg-brand-teal px-4 py-2.5 font-semibold text-white disabled:opacity-50">{isSubmitting ? 'Đang xử lý...' : `Xác nhận ${actionLabel}`}</button>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}
