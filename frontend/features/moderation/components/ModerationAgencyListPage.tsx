'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useGetModerationAgenciesQuery, useVerifyAgencyMutation } from '../api/moderationApi';
import { AGENCY_STATUS_LABELS, PERMISSION } from '../labels';
import type { AgencyVerificationStatus, ModerationAgency } from '../types';
import { DecisionDialog, type DecisionAction } from './DecisionDialog';
import { dateTime, FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;

/** Use case "Verify Agency Profile". */
export function ModerationAgencyListPage() {
  const canVerify = useModerationPermission(PERMISSION.agencyVerify);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<AgencyVerificationStatus>('PENDING');
  const { data, isLoading, isFetching, isError, refetch } = useGetModerationAgenciesQuery(
    { page, limit: PAGE_SIZE, status: filter },
    { skip: !canVerify },
  );
  const [verify, { isLoading: isVerifying }] = useVerifyAgencyMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!canVerify) return <ModerationDenied />;

  const selected: ModerationAgency | null = data?.items.find((a) => a.id === selectedId) ?? null;
  const name = (a: ModerationAgency) => a.agencyProfile?.companyName || a.fullName;

  const close = () => {
    setSelectedId(null);
    setServerError(null);
  };

  const decide = async (approve: boolean, note: string) => {
    if (!selected) return;
    setServerError(null);
    try {
      await verify({ id: selected.id, approve, ...(note ? { note } : {}) }).unwrap();
      setFeedback({ message: approve ? `Đã xác minh agency "${name(selected)}".` : `Đã từ chối hồ sơ agency "${name(selected)}".`, type: 'success' });
      close();
    } catch (err: unknown) {
      setServerError(moderationErrorMessage(err, 'Không thể xử lý hồ sơ lúc này. Vui lòng thử lại.'));
      void refetch();
    }
  };

  // Only a PENDING profile can be decided (backend state machine).
  const actions: DecisionAction[] =
    selected?.agencyProfile?.verificationStatus === 'PENDING'
      ? [
          { key: 'verify', label: 'Xác minh', tone: 'positive', requiresReason: false, onConfirm: (note) => void decide(true, note) },
          { key: 'reject', label: 'Từ chối', tone: 'negative', requiresReason: true, onConfirm: (note) => void decide(false, note) },
        ]
      : [];

  const profile = selected?.agencyProfile;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1 py-2 sm:px-0">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Xác minh hồ sơ agency</h1>
          <p className="mt-1 text-sm text-slate-500">Kiểm tra giấy phép kinh doanh và thông tin đối tác trước khi cho phép đăng tour.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as AgencyVerificationStatus);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {(Object.keys(AGENCY_STATUS_LABELS) as AgencyVerificationStatus[]).map((s) => (
              <option key={s} value={s}>
                {AGENCY_STATUS_LABELS[s].label}
              </option>
            ))}
          </select>
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
        </div>
      </header>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {isLoading ? (
        <LoadingState label="Đang tải danh sách agency..." />
      ) : isError ? (
        <ErrorState title="Không thể tải danh sách agency" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
          <EmptyState title="Không có hồ sơ nào" description="Không có hồ sơ agency nào ở trạng thái này." />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {data.items.map((a) => {
              const status = AGENCY_STATUS_LABELS[a.agencyProfile?.verificationStatus ?? 'UNVERIFIED'];
              return (
                <li key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{name(a)}</p>
                      <p className="mt-1 text-xs text-slate-500">{a.email} · Đăng ký {dateTime.format(new Date(a.createdAt))}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSelectedId(a.id);
                      }}
                      className="rounded-xl border border-purple-200 px-3 py-1.5 text-sm font-semibold text-purple-800 hover:bg-purple-50"
                    >
                      {a.agencyProfile?.verificationStatus === 'PENDING' ? 'Xem & xử lý' : 'Xem chi tiết'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={isFetching} showInfo itemLabel="agency" />
        </div>
      )}

      <DecisionDialog
        open={Boolean(selected)}
        title="Hồ sơ agency"
        reasonLabel="Ghi chú (bắt buộc khi từ chối, tùy chọn khi xác minh)"
        actions={actions}
        isSubmitting={isVerifying}
        serverError={serverError}
        onClose={close}
      >
        {selected && (
          <>
            <h3 className="text-base font-bold text-slate-900">{name(selected)}</h3>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-slate-700">
              <dt className="text-slate-500">Người đại diện</dt><dd>{selected.fullName}</dd>
              <dt className="text-slate-500">Email</dt><dd>{selected.email}</dd>
              {selected.phone && (<><dt className="text-slate-500">Điện thoại</dt><dd>{selected.phone}</dd></>)}
              {profile?.address && (<><dt className="text-slate-500">Địa chỉ</dt><dd>{profile.address}</dd></>)}
              {profile?.website && (<><dt className="text-slate-500">Website</dt><dd>{profile.website}</dd></>)}
              {profile?.licenseNumber && (<><dt className="text-slate-500">Số giấy phép</dt><dd>{profile.licenseNumber}</dd></>)}
              {profile?.taxId && (<><dt className="text-slate-500">Mã số thuế</dt><dd>{profile.taxId}</dd></>)}
            </dl>
            {profile?.businessLicenseUrl && (
              <a href={profile.businessLicenseUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-purple-700 underline">
                Xem giấy phép kinh doanh
              </a>
            )}
            {profile?.description && <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{profile.description}</p>}
            {profile?.verificationNote && (
              <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-900">
                <span className="font-bold">Ghi chú gần nhất:</span> {profile.verificationNote}
              </p>
            )}
          </>
        )}
      </DecisionDialog>
    </div>
  );
}
