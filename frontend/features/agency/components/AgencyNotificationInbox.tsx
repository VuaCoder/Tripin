'use client';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, RefreshCw, X } from 'lucide-react';
import { useAgencyNotificationsQuery, useReadAgencyNotificationMutation, useReadAllAgencyNotificationsMutation, useDeleteAgencyNotificationMutation } from '../notifications';
import { AgencyError, AgencyLoading, agencyButton, dateTime } from '../AgencyUi';
import { getTourApiMessage } from '@/features/tours/api/toursApi';

export function localizeNotificationContent(title: string, body: string): { title: string; body: string } {
  let localizedTitle = title;
  let localizedBody = body;

  const titleMap: Record<string, string> = {
    'New confirmed booking': 'Đặt tour mới đã xác nhận',
    'Booking confirmed': 'Đặt chỗ thành công',
    'Booking created': 'Đơn đặt chỗ mới',
    'A booking was cancelled': 'Đơn đặt tour đã huỷ',
    'Booking expired': 'Đơn đặt tour đã hết hạn',
    'New review': 'Đánh giá mới',
    'Your tour was approved': 'Tour đã được duyệt',
    'Your tour was rejected': 'Tour cần chỉnh sửa',
    'Your tour was suspended': 'Tour đã bị tạm ẩn',
    'Guide accepted the assignment': 'Hướng dẫn viên đã nhận tour',
    'Guide declined the assignment': 'Hướng dẫn viên đã từ chối tour',
    'How was your trip?': 'Chuyến đi của bạn thế nào?',
    'Support replied to your ticket': 'Hỗ trợ đã phản hồi yêu cầu',
    'Your support ticket was resolved': 'Yêu cầu hỗ trợ đã được giải quyết',
    'Payment received': 'Đã nhận thanh toán',
  };

  if (titleMap[title]) {
    localizedTitle = titleMap[title];
  }

  // Pattern 1: "{n} traveler(s) booked "{tourTitle}" ({code})."
  const travelerBookedMatch = body.match(/^(\d+)\s+traveler\(s\)\s+booked\s+"([^"]+)"\s+\(([^)]+)\)\.?$/i);
  if (travelerBookedMatch) {
    const [, count, tourTitle, code] = travelerBookedMatch;
    localizedBody = `${count} du khách đã đặt "${tourTitle}" (${code}).`;
  }

  // Pattern 2: "Payment received. Your booking {code} for "{tourTitle}" is confirmed."
  const paymentReceivedMatch = body.match(/^Payment received\.\s+Your booking\s+([^\s]+)\s+for\s+"([^"]+)"\s+is confirmed\.?$/i);
  if (paymentReceivedMatch) {
    const [, code, tourTitle] = paymentReceivedMatch;
    localizedBody = `Đã nhận thanh toán. Đơn đặt chỗ ${code} cho tour "${tourTitle}" đã được xác nhận.`;
  }

  // Pattern 3: "Booking {code} for "{tourTitle}" was cancelled by the traveler."
  const bookingCancelledMatch = body.match(/^Booking\s+([^\s]+)\s+for\s+"([^"]+)"\s+was cancelled by the traveler\.?$/i);
  if (bookingCancelledMatch) {
    const [, code, tourTitle] = bookingCancelledMatch;
    localizedBody = `Đơn đặt chỗ ${code} cho tour "${tourTitle}" đã bị huỷ bởi du khách.`;
  }

  // Pattern 4: "A traveler rated "{tourTitle}" {rating}/5."
  const reviewMatch = body.match(/^A traveler rated\s+"([^"]+)"\s+(\d+(?:\.\d+)?)\/5\.?$/i);
  if (reviewMatch) {
    const [, tourTitle, rating] = reviewMatch;
    localizedBody = `Một du khách đã đánh giá "${tourTitle}" ${rating}/5 sao.`;
  }

  // Pattern 5: "{tourTitle}" is now public.
  const tourPublicMatch = body.match(/^"([^"]+)"\s+is now public\.?$/i);
  if (tourPublicMatch) {
    const [, tourTitle] = tourPublicMatch;
    localizedBody = `Tour "${tourTitle}" hiện đã được công khai trên nền tảng.`;
  }

  // Pattern 6: "{tourTitle}" was rejected: {reason}
  const tourRejectedMatch = body.match(/^"([^"]+)"\s+was rejected:\s+(.+)$/i);
  if (tourRejectedMatch) {
    const [, tourTitle, reason] = tourRejectedMatch;
    localizedBody = `Tour "${tourTitle}" đã bị từ chối duyệt: ${reason}`;
  }

  // Pattern 7: "{tourTitle}" was suspended: {reason}
  const tourSuspendedMatch = body.match(/^"([^"]+)"\s+was suspended:\s+(.+)$/i);
  if (tourSuspendedMatch) {
    const [, tourTitle, reason] = tourSuspendedMatch;
    localizedBody = `Tour "${tourTitle}" đã bị tạm ẩn: ${reason}`;
  }

  // Pattern 8: "The guide accepted "{tourTitle}"."
  const guideAcceptMatch = body.match(/^The guide accepted\s+"([^"]+)"\.?(?:\s+Note:\s+(.+))?$/i);
  if (guideAcceptMatch) {
    const [, tourTitle, note] = guideAcceptMatch;
    localizedBody = `Hướng dẫn viên đã đồng ý phụ trách tour "${tourTitle}".${note ? ` Ghi chú: ${note}` : ''}`;
  }

  // Pattern 9: "The guide declined "{tourTitle}"."
  const guideDeclineMatch = body.match(/^The guide declined\s+"([^"]+)"\.?(?:\s+Note:\s+(.+))?$/i);
  if (guideDeclineMatch) {
    const [, tourTitle, note] = guideDeclineMatch;
    localizedBody = `Hướng dẫn viên đã từ chối phụ trách tour "${tourTitle}".${note ? ` Ghi chú: ${note}` : ''}`;
  }

  // Pattern 10: "Your trip "{tourTitle}" is over. Share your experience with a review."
  const tripOverMatch = body.match(/^Your trip\s+"([^"]+)"\s+is over\.\s+Share your experience with a review\.?$/i);
  if (tripOverMatch) {
    const [, tourTitle] = tripOverMatch;
    localizedBody = `Chuyến đi "${tourTitle}" của bạn đã hoàn thành. Hãy chia sẻ cảm nhận bằng một đánh giá nhé!`;
  }

  // Pattern 11: "Booking {code} was cancelled because it was not paid in time."
  const bookingExpiredMatch = body.match(/^Booking\s+([^\s]+)\s+was cancelled because it was not paid in time\.?$/i);
  if (bookingExpiredMatch) {
    const [, code] = bookingExpiredMatch;
    localizedBody = `Đơn đặt chỗ ${code} đã bị huỷ do không thanh toán đúng hạn.`;
  }

  return { title: localizedTitle, body: localizedBody };
}

export interface AgencyNotificationInboxProps {
  compact?: boolean;
  onClose?: () => void;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
}

export function AgencyNotificationInbox({ compact = false, onClose, closeRef }: AgencyNotificationInboxProps) {
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState('');
  const { currentData: result, isLoading, isFetching, error, refetch } = useAgencyNotificationsQuery(page, { pollingInterval: 30000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  const [read, readState] = useReadAgencyNotificationMutation();
  const [readAll, allState] = useReadAllAgencyNotificationsMutation();
  const [remove, deleteState] = useDeleteAgencyNotificationMutation();
  const busy = readState.isLoading || allState.isLoading || deleteState.isLoading;

  useEffect(() => {
    if (result && page > Math.max(1, result.meta.totalPages)) {
      setPage(Math.max(1, result.meta.totalPages));
    }
  }, [result, page]);

  const run = async (action: () => Promise<unknown>) => {
    setFailure('');
    try {
      await action();
    } catch (e) {
      setFailure(getTourApiMessage(e, 'Không thể cập nhật thông báo. Vui lòng thử lại.'));
    }
  };

  const unreadCount = result?.data.filter((item) => !item.isRead).length ?? 0;

  return (
    <div className="space-y-3.5 text-slate-900">
      {/* Header bar: Title, Refresh button, Mark All as Read button, and Close X button all on the same line */}
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Thông báo</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800 shrink-0">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Nút Làm mới */}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Làm mới thông báo"
            title="Làm mới"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>

          {/* Nút Đánh dấu tất cả đã đọc - chỉ icon */}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 cursor-pointer"
            disabled={busy || unreadCount === 0}
            onClick={() => void run(() => readAll().unwrap())}
            title="Đánh dấu tất cả đã đọc"
            aria-label="Đánh dấu tất cả đã đọc"
          >
            <CheckCheck size={16} />
          </button>

          {/* Nút X đóng panel (nếu có onClose) */}
          {onClose && (
            <button
              ref={closeRef as React.RefObject<HTMLButtonElement>}
              type="button"
              onClick={onClose}
              aria-label="Đóng thông báo"
              className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer ml-0.5"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {failure && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200">
          {failure}
        </p>
      )}

      {isLoading || (!result && isFetching) ? (
        <AgencyLoading />
      ) : error ? (
        <AgencyError message={getTourApiMessage(error, 'Không thể tải thông báo.')} retry={() => void refetch()} />
      ) : result ? (
        <>
          <div className={compact ? 'max-h-[52dvh] overflow-y-auto overscroll-contain pr-0.5 space-y-2.5' : 'space-y-3'} aria-busy={isFetching}>
            {result.data.length === 0 ? (
              <div className="rounded-2xl bg-teal-50/60 border border-teal-100 px-4 py-10 text-center">
                <Bell size={28} className="mx-auto mb-2.5 text-teal-600" />
                <h3 className="font-bold text-teal-950 text-sm">Bạn đã cập nhật hết rồi</h3>
                <p className="mt-1 text-xs text-teal-800">Thông báo mới sẽ tự xuất hiện tại đây khi có hoạt động.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {result.data.map((item) => {
                  const { title: localizedTitle, body: localizedBody } = localizeNotificationContent(item.title, item.body);

                  return (
                    <li
                      key={item.id}
                      className={`group relative rounded-2xl p-4 transition-all border ${
                        item.isRead
                          ? 'bg-white border-slate-200/80 hover:border-slate-300'
                          : 'bg-teal-50/50 border-teal-200/80 shadow-2xs hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="break-words text-sm font-bold text-slate-900 leading-snug">
                          {localizedTitle}
                        </h3>
                        {!item.isRead ? (
                          <button
                            type="button"
                            aria-label="Đánh dấu đã đọc"
                            onClick={() => void run(() => read(item.id).unwrap())}
                            className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800 hover:bg-teal-200 transition-colors shrink-0 cursor-pointer"
                            title="Bấm để đánh dấu đã đọc"
                          >
                            <span className="size-1.5 rounded-full bg-teal-600" />
                            Chưa đọc
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
                            <CheckCheck size={13} />
                            Đã đọc
                          </span>
                        )}
                      </div>

                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">
                        {localizedBody}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <time dateTime={item.createdAt} className="text-[11px] text-slate-400 font-medium">
                          {dateTime(item.createdAt)}
                        </time>

                        {/* Nút thùng rác duy nhất với nền đỏ theo yêu cầu */}
                        <button
                          type="button"
                          className="grid size-7 place-items-center rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          aria-label="Xoá thông báo"
                          title="Xoá thông báo"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm('Xoá thông báo này? Thao tác này không thể hoàn tác.')) {
                              void run(() => remove(item.id).unwrap());
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {result.meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
              <button
                type="button"
                className={agencyButton}
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </button>
              <span className="text-slate-500 font-medium">
                Trang {page}/{result.meta.totalPages}
              </span>
              <button
                type="button"
                className={agencyButton}
                disabled={page >= result.meta.totalPages || isFetching}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </button>
            </div>
          )}
        </>
      ) : (
        <p role="status" className="text-sm text-slate-600">Đang tải thông báo…</p>
      )}
    </div>
  );
}
