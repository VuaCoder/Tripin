'use client';

import { useState } from 'react';
import { ArrowUpRight, Building2, CalendarDays, FileCheck2, FileText, MapPin, RefreshCw, UserRound } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination, AntSelect, type AntSelectOption } from '@/components/ui';
import { useGetModerationAgenciesQuery, useVerifyAgencyMutation } from '../api/moderationApi';
import { AGENCY_STATUS_LABELS, PERMISSION } from '../labels';
import type { AgencyVerificationStatus } from '../types';
import { AgencyStatusBadge, AgencyVerificationDialog, agencySubmittedAt, agencyWebUrl } from './AgencyVerificationDialog';
import { FeedbackBanner, ModerationDenied, moderationErrorMessage, useModerationPermission, type Feedback } from './ModerationUi';

const PAGE_SIZE = 10;

export function ModerationAgencyListPage() {
  const canVerify = useModerationPermission(PERMISSION.agencyVerify);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<AgencyVerificationStatus>('PENDING');
  const { data, currentData, isLoading, isFetching, isError, refetch } = useGetModerationAgenciesQuery(
    { page, limit: PAGE_SIZE, status: filter },
    { skip: !canVerify, pollingInterval: 15_000, refetchOnFocus: true },
  );
  const [verify, { isLoading: isVerifying }] = useVerifyAgencyMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  if (!canVerify) return <ModerationDenied />;

  const selected = data?.items.find((agency) => agency.id === selectedId) ?? null;
  const close = () => { setSelectedId(null); setServerError(null); };
  const decide = async (approve: boolean, note: string, requestInformation = false) => {
    if (!selected) return;
    setServerError(null);
    try {
      await verify({ id: selected.id, approve, ...(requestInformation ? { requestInformation } : {}), ...(note ? { note } : {}) }).unwrap();
      const name = selected.agencyProfile?.companyName || selected.fullName;
      setFeedback({ message: requestInformation ? 'Đã yêu cầu Agency bổ sung thông tin.' : approve ? `Đã xác minh agency "${name}".` : `Đã từ chối hồ sơ agency "${name}".`, type: 'success' });
      close();
    } catch (error: unknown) {
      setServerError(moderationErrorMessage(error, 'Không thể xử lý hồ sơ lúc này. Vui lòng thử lại.'));
      void refetch();
    }
  };
  const options: AntSelectOption<AgencyVerificationStatus>[] = (Object.keys(AGENCY_STATUS_LABELS) as AgencyVerificationStatus[]).map((status) => ({ value: status, label: AGENCY_STATUS_LABELS[status].label }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-2 text-slate-900 selection:bg-teal-100">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Xác minh hồ sơ agency</h1><p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">Kiểm tra thông tin doanh nghiệp và giấy tờ trước khi xác minh đối tác.</p></div>
        <button type="button" disabled={isFetching} onClick={() => void refetch()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"><RefreshCw aria-hidden="true" className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />Làm mới</button>
      </header>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      <section aria-label="Danh sách hồ sơ" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3"><FileCheck2 className="size-5 text-teal-800" aria-hidden="true" /><h2 className="text-lg font-semibold">Hồ sơ doanh nghiệp</h2>{!isError && !isLoading && (!isFetching || currentData) && data && <span className="rounded-lg bg-slate-200/60 px-2.5 py-1 text-sm font-semibold tabular-nums">{data.meta.total}</span>}</div>
          <div className="flex items-center gap-3"><span className="text-sm text-slate-600">Trạng thái</span><AntSelect<AgencyVerificationStatus> aria-label="Lọc theo trạng thái" value={filter} onChange={(value) => { setFilter(value); setPage(1); close(); }} options={options} size="middle" className="min-w-[190px]" /></div>
        </div>

        {isLoading || (isFetching && !data) ? <LoadingState label="Đang tải danh sách agency..." /> : isError ? <ErrorState title="Không thể tải danh sách agency" message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại." onAction={() => void refetch()} /> : !data || data.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12"><EmptyState title="Không có hồ sơ nào" description="Không có hồ sơ agency nào ở trạng thái này. Bạn có thể chọn trạng thái khác để xem hồ sơ." /></div>
        ) : <>
          <ul className="space-y-4" aria-busy={isFetching}>
            {data.items.map((agency) => {
              const profile = agency.agencyProfile;
              const hasDocument = !!agencyWebUrl(profile?.businessLicenseUrl);
              return <li key={agency.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                  <div className="flex min-w-0 flex-1 items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Building2 className="size-6" aria-hidden="true" /></span><div className="min-w-0"><h3 className="break-words text-xl font-semibold tracking-tight">{profile?.companyName || agency.fullName}</h3><p className="mt-1 break-words text-sm text-slate-600">{agency.email}</p></div></div>
                  <AgencyStatusBadge agency={agency} />
                </div>
                <dl className="grid gap-5 px-5 pb-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                  <div className="min-w-0"><dt className="mb-2 flex items-center gap-2 text-sm text-slate-500"><UserRound className="size-4" aria-hidden="true" />Người đại diện</dt><dd className="break-words text-base">{agency.fullName || 'Chưa cung cấp'}</dd></div>
                  <div className="min-w-0"><dt className="mb-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="size-4" aria-hidden="true" />Địa chỉ</dt><dd className="break-words text-base">{profile?.address || 'Chưa cung cấp'}</dd></div>
                  <div className="min-w-0"><dt className="mb-2 flex items-center gap-2 text-sm text-slate-500"><FileText className="size-4" aria-hidden="true" />Số giấy phép</dt><dd className="break-words text-base">{profile?.licenseNumber || 'Chưa cung cấp'}</dd></div>
                  <div className="min-w-0"><dt className="mb-2 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="size-4" aria-hidden="true" />Nộp hồ sơ</dt><dd className="text-sm leading-6 tabular-nums">{agencySubmittedAt(agency)}</dd></div>
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6"><p className="flex items-center gap-2 text-sm text-slate-600"><FileText className="size-4" aria-hidden="true" />{hasDocument ? 'Có giấy phép kinh doanh đính kèm' : 'Chưa có tài liệu hợp lệ đính kèm'}</p><button type="button" onClick={() => { setServerError(null); setSelectedId(agency.id); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">{profile?.verificationStatus === 'PENDING' ? 'Xem & xử lý' : 'Xem chi tiết'}<ArrowUpRight className="size-4" aria-hidden="true" /></button></div>
              </li>;
            })}
          </ul>
          <Pagination currentPage={data.meta.page} totalPages={data.meta.totalPages} totalItems={data.meta.total} pageSize={PAGE_SIZE} onPageChange={(value) => { setPage(value); close(); }} disabled={isFetching} showInfo itemLabel="hồ sơ" />
        </>}
      </section>
      {selected && <AgencyVerificationDialog key={selected.id} agency={selected} isSubmitting={isVerifying} serverError={serverError} onClose={close} onDecide={decide} />}
    </div>
  );
}
