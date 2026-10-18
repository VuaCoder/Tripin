'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useGetAdminCommissionQuery, useSetAdminCommissionMutation } from '../api/adminApi';
import type { Commission } from '../types';
import { commissionValue } from '../validation';
import { AdminFrame, adminError, Feedback, forbidden, panel, timestamp, useAdminSession } from './AdminUi';

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
      const result = await save(rate).unwrap(); dirty.current = false; setConfirmed(result); setValue(String(result.ratePercent)); setConfirm(false); setSuccess('Đã lưu mức hoa hồng theo xác nhận của backend.');
    } catch (e) { setConfirm(false); setError(adminError(e)); if (forbidden(e)) onDenied(e); }
  };
  return <section className={panel}>
    <p className="mb-2 text-sm">Mức đã lưu: <strong>{confirmed.ratePercent}%</strong> ({confirmed.rateBps} bps) · {timestamp(confirmed.updatedAt)}</p>
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
  const [denied, setDenied] = useState<unknown>();
  if (!ready) return null;
  return <AdminFrame title="Hoa hồng nền tảng" description="Cấu hình một mức hoa hồng chung cho toàn nền tảng." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    {query.currentData && <CommissionForm saved={query.currentData} onDenied={setDenied} />}
  </AdminFrame>;
}
