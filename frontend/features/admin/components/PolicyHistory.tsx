'use client';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { usePolicyHistoryQuery, useRollbackPolicyMutation } from '../api/operationsApi';
import type { Policy } from '../types';
import { Feedback, adminError, timestamp } from './AdminUi';
import { Shimmer } from './AdminSkeletons';
const readableParameters = (params: Record<string, number | string | boolean>) => {
  const labels: Record<string, string> = { cancellationWindowHours: 'Thời hạn hủy trước khởi hành', milestonesJson: 'Mốc hoàn tiền', slaHours: 'Thời gian xử lý báo cáo', escalationSlaHours: 'Thời hạn xử lý ưu tiên' };
  return Object.entries(params).map(([key, value]) => {
    if (key === 'milestonesJson') {
      try { value = (JSON.parse(String(value)) as { daysBefore: number; percent: number }[]).map((item) => `Hủy trước ${item.daysBefore} ngày: hoàn ${item.percent}%`).join(' · '); } catch { value = 'Chưa thiết lập hợp lệ'; }
    } else if (key === 'cancellationWindowHours') value = `${value} giờ trước khởi hành`;
    else if (key === 'slaHours' || key === 'escalationSlaHours') value = `${value} giờ`;
    return { label: labels[key] ?? 'Cách áp dụng', value: String(value) };
  });
};
export function PolicyHistory({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const query = usePolicyHistoryQuery(policy.key);
  const [rollback, state] = useRollbackPolicyMutation();
  const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null);
  return <Modal open title={`Lịch sử: ${policy.title}`} className="max-h-[85vh] max-w-3xl overflow-y-auto" onClose={onClose}>
    <Feedback error={error || (query.isError ? 'Không tải được lịch sử.' : null)} />
    {query.isError && <Button onClick={() => void query.refetch()}>Thử lại</Button>}
    <label className="block">Lý do khôi phục (ít nhất 10 ký tự)<textarea className="block w-full rounded border p-2" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
    {query.isLoading ? <div role="status" aria-label="Đang tải lịch sử chính sách" className="space-y-3 py-4"><span className="sr-only">Đang tải lịch sử chính sách</span>{Array.from({ length: 3 }, (_, i) => <section key={i} className="space-y-3 rounded-xl border border-slate-200 p-4"><Shimmer className="h-4 w-48" /><Shimmer className="h-3 w-64 max-w-full" /><Shimmer className="h-10 w-full" /><Shimmer className="h-9 w-44 rounded-lg" /></section>)}</div> : query.data?.length === 0 ? <p>Chưa có phiên bản được lưu.</p> : query.data?.map((v) => <section key={v.id} className="my-3 space-y-2 rounded border p-3"><h3 className="font-bold">Phiên bản {v.versionNumber} · Hiệu lực {timestamp(v.effectiveFrom)}</h3><p>{v.reason}</p><details><summary>Xem nội dung và cách áp dụng</summary><p className="whitespace-pre-wrap">{v.value.content}</p><dl className="mt-3 space-y-2">{readableParameters(v.value.params).map((item) => <div key={item.label}><dt className="text-sm font-medium text-slate-600">{item.label}</dt><dd className="text-sm text-slate-900">{item.value}</dd></div>)}</dl></details><Button variant="outline" disabled={state.isLoading || reason.trim().length < 10} onClick={async () => { setError(null); try { await rollback({ key: policy.key, versionId: v.id, expectedVersion: policy.version ?? 0, reason: reason.trim() }).unwrap(); onClose(); } catch (e) { setError(adminError(e)); } }}>Khôi phục thành phiên bản mới</Button></section>)}
  </Modal>;
}
