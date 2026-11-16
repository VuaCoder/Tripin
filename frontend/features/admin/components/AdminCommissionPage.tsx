'use client';
import { useEffect, useRef, useState } from 'react';
import { Building2, Edit3, Search } from 'lucide-react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { FormSelect } from '@/components/ui/FormSelect';
import { useApproveAgencyCommissionRequestMutation, useGetAdminCommissionQuery, useGetAgencyCommissionRequestsQuery, useGetAgencyCommissionsQuery, useRejectAgencyCommissionRequestMutation, useSetAdminCommissionMutation, useSetAgencyCommissionMutation } from '../api/adminApi';
import type { AgencyCommission, AgencyCommissionRequest, Commission } from '../types';
import { commissionValue } from '../validation';
import { AdminFrame, adminError, Feedback, forbidden, panel, useAdminSession } from './AdminUi';
import { AdminCommissionSkeleton } from './AdminSkeletons';

function CommissionForm({ saved, onDenied }: { saved: Commission; onDenied: (error: unknown) => void }) {
  const [value, setValue] = useState(String(saved.ratePercent));
  const [confirmed, setConfirmed] = useState<Commission>(saved);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [save, { isLoading }] = useSetAdminCommissionMutation();
  const dirty = useRef(false);
  useEffect(() => {
    setConfirmed(saved);
    if (!dirty.current) setValue(String(saved.ratePercent));
  }, [saved]);
  const submit = async () => {
    const rate = commissionValue(value);
    if (rate === null || isLoading) return;
    setError(null); setSuccess(null);
    try {
      const result = await save({ ratePercent: rate, expectedVersion: confirmed.version ?? 0 }).unwrap(); dirty.current = false; setConfirmed(result); setValue(String(result.ratePercent)); setConfirm(false); setSuccess('Đã lưu mức hoa hồng theo xác nhận của backend.');
    } catch (e) { setConfirm(false); setError(adminError(e)); if (forbidden(e)) onDenied(e); }
  };
  return <section className={panel}>
    <p className="mb-2 text-sm">Mức đang áp dụng: <strong>{confirmed.ratePercent}%</strong></p>
    <Feedback error={error} success={success} />
    <form className="mt-4 max-w-lg space-y-4" onSubmit={(e) => { e.preventDefault(); setSuccess(null); if (commissionValue(value) === null) setError('Nhập mức từ 0 đến 100%, tối đa hai chữ số thập phân.'); else { setError(null); setConfirm(true); } }} noValidate>
      <FormField label="Hoa hồng nền tảng (%)" htmlFor="commission-rate" required><Input id="commission-rate" inputMode="decimal" value={value} onChange={(e) => { dirty.current = true; setValue(e.target.value); setSuccess(null); }} disabled={isLoading} /></FormField>
      <Button type="submit" disabled={isLoading || commissionValue(value) === confirmed.ratePercent}>Lưu hoa hồng</Button>
    </form>
    <Modal open={confirm} title="Xác nhận thay đổi hoa hồng" closeOnBackdrop={!isLoading} onClose={() => { if (!isLoading) setConfirm(false); }}><p>Đổi mức hoa hồng toàn nền tảng từ {confirmed.ratePercent}% thành {value}% cho booking mới?</p><div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={isLoading} onClick={() => setConfirm(false)}>Hủy</Button><Button loading={isLoading} onClick={() => void submit()}>Xác nhận lưu</Button></div></Modal>
  </section>;
}
export function AdminCommissionPage() {
  const { ready } = useAdminSession();
  const query = useGetAdminCommissionQuery(undefined, { skip: !ready, refetchOnMountOrArgChange: true });
  const agenciesQuery = useGetAgencyCommissionsQuery(undefined, { skip: !ready, refetchOnMountOrArgChange: true });
  const [denied, setDenied] = useState<unknown>();
  const [agencySearch, setAgencySearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'common' | 'specific'>('all');
  const [sortKey, setSortKey] = useState<'name' | 'rate'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingAgency, setEditingAgency] = useState<AgencyCommission | null>(null);
  const [agencyRate, setAgencyRate] = useState('');
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [saveAgency, agencySave] = useSetAgencyCommissionMutation();
  const requestsQuery = useGetAgencyCommissionRequestsQuery({ status: 'PENDING', limit: 20 }, { skip: !ready, refetchOnMountOrArgChange: true });
  const [approveRequest, approveState] = useApproveAgencyCommissionRequestMutation();
  const [rejectRequest, rejectState] = useRejectAgencyCommissionRequestMutation();
  const [reviewing, setReviewing] = useState<{ request: AgencyCommissionRequest; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  if (!ready) return null;
  const defaultRate = query.currentData?.ratePercent ?? 0;
  const effectiveRateOf = (agency: AgencyCommission) => agency.ratePercent ?? defaultRate;
  const visibleAgencies = (agenciesQuery.currentData ?? [])
    .filter((agency) => `${agency.companyName} ${agency.contactName} ${agency.email}`.toLocaleLowerCase('vi').includes(agencySearch.toLocaleLowerCase('vi')))
    .filter((agency) => sourceFilter === 'all' || (sourceFilter === 'common' ? agency.ratePercent === null : agency.ratePercent !== null))
    .sort((a, b) => {
      const aV = sortKey === 'name' ? a.companyName.toLocaleLowerCase('vi') : effectiveRateOf(a);
      const bV = sortKey === 'name' ? b.companyName.toLocaleLowerCase('vi') : effectiveRateOf(b);
      if (aV === bV) return a.id.localeCompare(b.id);
      const cmp = aV > bV ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  const toggleSort = (key: 'name' | 'rate') => {
    if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortHeader = ({ label, k }: { label: string; k: 'name' | 'rate' }) => (
    <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700">
      {label}
      <span className="text-slate-400">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
  const saveAgencyRate = async () => {
    if (!editingAgency) return;
    const parsed = agencyRate.trim() === '' ? null : commissionValue(agencyRate);
    if (agencyRate.trim() !== '' && parsed === null) { setAgencyError('Nhập mức từ 0 đến 100%, tối đa hai chữ số thập phân.'); return; }
    setAgencyError(null);
    try {
      await saveAgency({ id: editingAgency.id, ratePercent: parsed, expectedVersion: editingAgency.version }).unwrap();
      setEditingAgency(null);
    } catch (error) { setAgencyError(adminError(error)); if (forbidden(error)) setDenied(error); }
  };
  const submitReview = async () => {
    if (!reviewing) return;
    if (reviewing.action === 'reject' && !reviewNote.trim()) { setReviewError('Vui lòng nhập lý do từ chối.'); return; }
    setReviewError(null);
    try {
      if (reviewing.action === 'approve') await approveRequest({ id: reviewing.request.id, note: reviewNote.trim() || undefined }).unwrap();
      else await rejectRequest({ id: reviewing.request.id, note: reviewNote.trim() }).unwrap();
      setReviewing(null); setReviewNote('');
    } catch (error) { setReviewError(adminError(error)); if (forbidden(error)) setDenied(error); }
  };
  const pendingRequests = requestsQuery.currentData?.items ?? [];
  return <AdminFrame title="Phí dịch vụ" description="Đặt mức chung cho nền tảng và mức riêng cho từng công ty lữ hành. Mọi thay đổi chỉ áp dụng cho đơn đặt mới." error={denied || query.error || agenciesQuery.error || requestsQuery.error} loading={!query.currentData || !agenciesQuery.currentData || !requestsQuery.currentData} loadingSkeleton={<AdminCommissionSkeleton />} refreshing={(query.isFetching || agenciesQuery.isFetching || requestsQuery.isFetching) && !!query.currentData && !!agenciesQuery.currentData} onRefresh={() => Promise.all([query.refetch(), agenciesQuery.refetch(), requestsQuery.refetch()])}>
    {query.currentData && <>
      <section className={panel}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Building2 size={19} /></span><div><h2 className="font-semibold text-slate-900">Mức chung mặc định</h2><p className="text-sm text-slate-600">Dùng cho agency chưa có mức riêng.</p></div></div>
          <Button type="button" variant="outline" className="inline-flex items-center gap-2" onClick={() => setRequestsOpen(true)}>
            Yêu cầu
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">{requestsQuery.currentData?.meta.total ?? 0} chờ</span>
          </Button>
        </div>
        <CommissionForm saved={query.currentData} onDenied={setDenied} />
      </section>
      <section className={`${panel} !p-0 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-semibold text-slate-900">Mức phí theo agency</h2></div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block w-40 sm:w-48"><FormSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as 'all' | 'common' | 'specific')}><option value="all">Nguồn mức phí: Tất cả</option><option value="common">Mức chung</option><option value="specific">Mức riêng</option></FormSelect></label>
            <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><span className="sr-only">Tìm agency</span><Input value={agencySearch} onChange={(event) => setAgencySearch(event.target.value)} placeholder="Tìm agency..." className="pl-9" /></label>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3"><SortHeader label="Agency" k="name" /></th><th className="px-4 py-3"><SortHeader label="Mức đang áp dụng" k="rate" /></th><th className="px-4 py-3">Nguồn mức phí</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleAgencies.map((agency) => <tr key={agency.id}><td className="px-5 py-4"><strong className="block text-slate-900">{agency.companyName}</strong><span className="text-xs text-slate-500">{agency.contactName}{agency.email ? ` · ${agency.email}` : ''}</span></td><td className="px-4 py-4 font-semibold">{effectiveRateOf(agency)}%</td><td className="px-4 py-4 text-slate-600">{agency.ratePercent === null ? 'Mức chung' : 'Mức riêng'}</td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" className="inline-flex items-center gap-2" onClick={() => { setEditingAgency(agency); setAgencyRate(agency.ratePercent === null ? '' : String(agency.ratePercent)); setAgencyError(null); }}><Edit3 size={15}/>Sửa</Button></td></tr>)}{visibleAgencies.length === 0 && <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={4}>Không tìm thấy agency phù hợp.</td></tr>}</tbody></table></div>
      </section>
      {requestsOpen && <Modal open title="Yêu cầu điều chỉnh chiết khấu" className="max-w-6xl" onClose={() => { if (!approveState.isLoading && !rejectState.isLoading && !reviewing) setRequestsOpen(false); }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Agency gửi mức % doanh nghiệp hưởng; duyệt sẽ đổi phí nền tảng cho booking tạo sau.</p>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{requestsQuery.currentData?.meta.total ?? 0} đang chờ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-5 py-3">Agency</th><th className="px-4 py-3">Hiện tại</th><th className="px-4 py-3">Đề nghị</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">Ngày gửi</th><th className="px-5 py-3 text-right">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-4"><strong className="block text-slate-900">{request.agencyName}</strong><span className="text-xs text-slate-500">{request.requestedByName}</span></td>
                  <td className="px-4 py-4"><span className="font-semibold text-slate-400 line-through">{request.currentSharePercent}%</span></td>
                  <td className="px-4 py-4"><span className="text-base font-bold text-teal-700">{request.requestedSharePercent}%</span></td>
                  <td className="max-w-xs px-4 py-4 text-slate-600">{request.reason}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">{(() => { const d = new Date(request.createdAt); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())} - ${p(d.getDate())}/${p(d.getMonth() + 1)}`; })()}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => { setReviewing({ request, action: 'approve' }); setReviewNote(''); setReviewError(null); }}>Duyệt</Button>
                      <Button variant="outline" size="sm" onClick={() => { setReviewing({ request, action: 'reject' }); setReviewNote(''); setReviewError(null); }}>Từ chối</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingRequests.length === 0 && <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={6}>Không có yêu cầu nào đang chờ.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>}
      {reviewing && <Modal open title={reviewing.action === 'approve' ? 'Duyệt yêu cầu chiết khấu' : 'Từ chối yêu cầu chiết khấu'} onClose={() => { if (!approveState.isLoading && !rejectState.isLoading) setReviewing(null); }}>
        <Feedback error={reviewError} />
        <p className="text-sm text-slate-600">{reviewing.request.agencyName}: mức hiện tại <strong>{reviewing.request.currentSharePercent}%</strong> → đề nghị <strong>{reviewing.request.requestedSharePercent}%</strong> doanh nghiệp hưởng.</p>
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Phí nền tảng sau khi duyệt: {100 - reviewing.request.requestedSharePercent}%. Chỉ áp dụng cho booking tạo sau thời điểm duyệt.</p>
        <label htmlFor="commission-review-note" className="mt-4 block text-xs font-bold text-slate-700">{reviewing.action === 'reject' ? 'Lý do từ chối' : 'Ghi chú (không bắt buộc)'}</label>
        <textarea id="commission-review-note" rows={3} maxLength={1000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20" />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={approveState.isLoading || rejectState.isLoading} onClick={() => setReviewing(null)}>Hủy</Button>
          {reviewing.action === 'approve'
            ? <Button loading={approveState.isLoading} onClick={() => void submitReview()}>Duyệt</Button>
            : <Button variant="danger" loading={rejectState.isLoading} onClick={() => void submitReview()}>Từ chối</Button>}
        </div>
      </Modal>}
      {editingAgency && <Modal open title={`Mức phí · ${editingAgency.companyName}`} onClose={() => { if (!agencySave.isLoading) setEditingAgency(null); }}><Feedback error={agencyError}/><p className="mb-4 text-sm text-slate-600">Để trống để agency sử dụng mức chung ({query.currentData.ratePercent}%).</p><FormField label="Mức phí riêng (%)" htmlFor="agency-commission-rate"><Input id="agency-commission-rate" inputMode="decimal" value={agencyRate} onChange={(event) => setAgencyRate(event.target.value)} placeholder="Để trống = dùng mức chung" /></FormField><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={agencySave.isLoading} onClick={() => setEditingAgency(null)}>Hủy</Button><Button loading={agencySave.isLoading} onClick={() => void saveAgencyRate()}>Lưu mức phí</Button></div></Modal>}
    </>}
  </AdminFrame>;
}
