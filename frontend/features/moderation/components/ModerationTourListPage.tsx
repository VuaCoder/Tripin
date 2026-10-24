'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useGetModerationToursQuery, useSuspendTourMutation, useValidateTourMutation } from '../api/moderationApi';
import { PERMISSION, TOUR_STATUS_LABELS } from '../labels';
import type { ModerationTour, ModerationTourStatus } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { dateTime, FeedbackBanner, ModerationDenied, money, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ModerationTourStatus;

interface Props {
  initialStatus?: StatusFilter;
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
  const { data, isLoading, isFetching, isError, refetch } = useGetModerationToursQuery(
    { page, limit: PAGE_SIZE, ...(filter === 'ALL' ? {} : { status: filter }), ...(q ? { q } : {}) },
    { skip: !canList },
  );
  const [validate, { isLoading: isValidating }] = useValidateTourMutation();
  const [suspend, { isLoading: isSuspending }] = useSuspendTourMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2 sm:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Kiểm duyệt tour</h1>
          <p className="mt-1 text-sm text-slate-500">Xem toàn bộ tour trên hệ thống, duyệt tour chờ duyệt hoặc tạm ngưng tour vi phạm.</p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <input
            type="search"
            aria-label="Tìm theo tên tour"
            placeholder="Tìm theo tên tour"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <select
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(TOUR_STATUS_LABELS) as ModerationTourStatus[]).map((s) => (
              <option key={s} value={s}>
                {TOUR_STATUS_LABELS[s].label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-purple-700 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-800">
            Tìm
          </button>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
          </button>
        </form>
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
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((t) => {
              const status = TOUR_STATUS_LABELS[t.status];
              return (
                <li key={t.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                        <span className="text-xs text-slate-500">{t.destination} · {t.durationDays} ngày</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{t.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.agency?.name ?? 'Không rõ agency'} · {money.format(t.basePrice)} · Cập nhật {dateTime.format(new Date(t.updatedAt))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(t.id);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      {t.status === 'PENDING_REVIEW' || t.status === 'APPROVED' ? 'Xem & xử lý' : 'Xem chi tiết'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="tour" />
        </div>
      )}

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
              {selected.submittedAt ? ` · Gửi duyệt ${dateTime.format(new Date(selected.submittedAt))}` : ''}
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
    </div>
  );
}
