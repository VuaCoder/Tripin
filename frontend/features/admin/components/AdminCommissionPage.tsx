'use client';
import { useEffect, useRef, useState } from 'react';
import { Building2, Edit3, Search } from 'lucide-react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useGetAdminCommissionQuery, useGetAgencyCommissionsQuery, useSetAdminCommissionMutation, useSetAgencyCommissionMutation } from '../api/adminApi';
import type { AgencyCommission, Commission } from '../types';
import { commissionValue } from '../validation';
import { AdminFrame, adminError, Feedback, forbidden, panel, timestamp, useAdminSession } from './AdminUi';
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
    <p className="mb-2 text-sm">Mức đang áp dụng: <strong>{confirmed.ratePercent}%</strong> · Cập nhật {timestamp(confirmed.updatedAt)}</p>
    <Feedback error={error} success={success} />
    <form className="mt-4 max-w-lg space-y-4" onSubmit={(e) => { e.preventDefault(); setSuccess(null); if (commissionValue(value) === null) setError('Nhập mức từ 0 đến 100%, tối đa hai chữ số thập phân.'); else { setError(null); setConfirm(true); } }} noValidate>
      <FormField label="Hoa hồng nền tảng (%)" htmlFor="commission-rate" required hint="Chỉ áp dụng cho booking tạo sau thay đổi; booking cũ giữ nguyên mức đã chốt."><Input id="commission-rate" inputMode="decimal" value={value} onChange={(e) => { dirty.current = true; setValue(e.target.value); setSuccess(null); }} disabled={isLoading} /></FormField>
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
  const [editingAgency, setEditingAgency] = useState<AgencyCommission | null>(null);
  const [agencyRate, setAgencyRate] = useState('');
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [saveAgency, agencySave] = useSetAgencyCommissionMutation();
  if (!ready) return null;
  const visibleAgencies = (agenciesQuery.currentData ?? []).filter((agency) => `${agency.companyName} ${agency.contactName} ${agency.email}`.toLocaleLowerCase('vi').includes(agencySearch.toLocaleLowerCase('vi')));
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
  return <AdminFrame title="Phí dịch vụ" description="Đặt mức chung cho nền tảng và mức riêng cho từng công ty lữ hành. Mọi thay đổi chỉ áp dụng cho đơn đặt mới." error={denied || query.error || agenciesQuery.error} loading={!query.currentData || !agenciesQuery.currentData} loadingSkeleton={<AdminCommissionSkeleton />} refreshing={(query.isFetching || agenciesQuery.isFetching) && !!query.currentData && !!agenciesQuery.currentData} onRefresh={() => Promise.all([query.refetch(), agenciesQuery.refetch()])}>
    {query.currentData && <>
      <section className={panel}>
        <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Building2 size={19} /></span><div><h2 className="font-semibold text-slate-900">Mức chung mặc định</h2><p className="text-sm text-slate-600">Dùng cho agency chưa có mức riêng.</p></div></div>
        <CommissionForm saved={query.currentData} onDenied={setDenied} />
      </section>
      <section className={`${panel} !p-0 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-semibold text-slate-900">Mức phí theo agency</h2><p className="mt-1 text-sm text-slate-600">Booking cũ giữ mức đã chốt; mức riêng thay thế mức chung cho booking tạo sau.</p></div>
          <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><span className="sr-only">Tìm agency</span><Input value={agencySearch} onChange={(event) => setAgencySearch(event.target.value)} placeholder="Tìm agency..." className="pl-9" /></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Agency</th><th className="px-4 py-3">Mức đang áp dụng</th><th className="px-4 py-3">Nguồn mức phí</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleAgencies.map((agency) => <tr key={agency.id}><td className="px-5 py-4"><strong className="block text-slate-900">{agency.companyName}</strong><span className="text-xs text-slate-500">{agency.contactName}{agency.email ? ` · ${agency.email}` : ''}</span></td><td className="px-4 py-4 font-semibold">{agency.ratePercent ?? query.currentData!.ratePercent}%</td><td className="px-4 py-4 text-slate-600">{agency.ratePercent === null ? 'Mức chung' : 'Mức riêng'}</td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" className="inline-flex items-center gap-2" onClick={() => { setEditingAgency(agency); setAgencyRate(agency.ratePercent === null ? '' : String(agency.ratePercent)); setAgencyError(null); }}><Edit3 size={15}/>{agency.ratePercent === null ? 'Đặt mức riêng' : 'Điều chỉnh'}</Button></td></tr>)}{visibleAgencies.length === 0 && <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={4}>Không tìm thấy agency phù hợp.</td></tr>}</tbody></table></div>
      </section>
      {editingAgency && <Modal open title={`Mức phí · ${editingAgency.companyName}`} onClose={() => { if (!agencySave.isLoading) setEditingAgency(null); }}><Feedback error={agencyError}/><p className="mb-4 text-sm text-slate-600">Để trống để agency sử dụng mức chung ({query.currentData.ratePercent}%).</p><FormField label="Mức phí riêng (%)" htmlFor="agency-commission-rate"><Input id="agency-commission-rate" inputMode="decimal" value={agencyRate} onChange={(event) => setAgencyRate(event.target.value)} placeholder="Để trống = dùng mức chung" /></FormField><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={agencySave.isLoading} onClick={() => setEditingAgency(null)}>Hủy</Button><Button loading={agencySave.isLoading} onClick={() => void saveAgencyRate()}>Lưu mức phí</Button></div></Modal>}
    </>}
  </AdminFrame>;
}
