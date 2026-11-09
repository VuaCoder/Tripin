'use client';
import { useState } from 'react';
import { useGetAdminPoliciesQuery } from '@/features/admin/api/adminApi';
import { useAcceptPolicyMutation } from '@/features/admin/api/operationsApi';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
export default function Page() {
  const query = useGetAdminPoliciesQuery(); const user = useAppSelector(selectUser);
  const [accept, state] = useAcceptPolicyMutation(); const [accepted, setAccepted] = useState<string[]>([]); const [error, setError] = useState('');
  return <main className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-2xl font-bold">Điều khoản và chính sách</h1>{query.isError && <button onClick={() => void query.refetch()}>Không tải được dữ liệu — thử lại</button>}{error && <p role="alert">{error}</p>}{query.data?.filter((p) => p.key !== 'moderation').map((p) => <section className="space-y-3 rounded border p-4" key={p.key}><h2 className="font-bold">{p.title}</h2><p className="whitespace-pre-wrap">{p.content || 'Chưa có nội dung.'}</p>{user && p.policyVersionId && p.content.trim() && ['terms', 'privacy'].includes(p.key) && <button className="rounded border px-3 py-2" disabled={state.isLoading || accepted.includes(p.policyVersionId)} onClick={async () => { try { await accept(p.policyVersionId!).unwrap(); setAccepted((v) => [...v, p.policyVersionId!]); setError(''); } catch { setError('Không lưu được xác nhận. Vui lòng thử lại.'); } }}>{accepted.includes(p.policyVersionId) ? 'Đã đồng ý phiên bản này' : `Tôi đã đọc và đồng ý phiên bản ${p.activeVersion ?? 0}`}</button>}</section>)}</main>;
}
