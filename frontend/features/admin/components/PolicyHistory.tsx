'use client';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { usePolicyHistoryQuery, useRollbackPolicyMutation } from '../api/operationsApi';
import type { Policy } from '../types';
import { Feedback, adminError, timestamp } from './AdminUi';
export function PolicyHistory({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const query = usePolicyHistoryQuery(policy.key);
  const [rollback, state] = useRollbackPolicyMutation();
  const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null);
  return <Modal open title={`Lịch sử: ${policy.title}`} className="max-h-[85vh] max-w-3xl overflow-y-auto" onClose={onClose}>
    <Feedback error={error || (query.isError ? 'Không tải được lịch sử.' : null)} />
    {query.isError && <Button onClick={() => void query.refetch()}>Thử lại</Button>}
    <label className="block">Lý do khôi phục (ít nhất 10 ký tự)<textarea className="block w-full rounded border p-2" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
    {query.isLoading ? <p>Đang tải…</p> : query.data?.length === 0 ? <p>Chưa có phiên bản được lưu.</p> : query.data?.map((v) => <section key={v.id} className="my-3 space-y-2 rounded border p-3"><h3 className="font-bold">Phiên bản {v.versionNumber} · Hiệu lực {timestamp(v.effectiveFrom)}</h3><p>{v.reason}</p><details><summary>Xem nội dung và tham số</summary><p className="whitespace-pre-wrap">{v.value.content}</p><pre className="overflow-auto">{JSON.stringify(v.value.params, null, 2)}</pre></details><Button variant="outline" disabled={state.isLoading || reason.trim().length < 10} onClick={async () => { setError(null); try { await rollback({ key: policy.key, versionId: v.id, expectedVersion: policy.version ?? 0, reason: reason.trim() }).unwrap(); onClose(); } catch (e) { setError(adminError(e)); } }}>Khôi phục thành phiên bản mới</Button></section>)}
  </Modal>;
}
