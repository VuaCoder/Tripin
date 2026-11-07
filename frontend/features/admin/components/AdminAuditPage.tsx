'use client';
import { useState } from 'react';
import { baseApi } from '@/store/api/baseApi';
import { Button } from '@/components/ui';
import { AdminFrame, Feedback, adminError, useAdminSession } from './AdminUi';
type Audit = { id: string; action: string; actorId: string; targetType: string; targetId?: string; metadata?: Record<string, unknown>; createdAt: string };
const api = baseApi.injectEndpoints({ endpoints: (build) => ({
  auditList: build.query<{ items: Audit[]; meta: { totalPages: number } }, { page: number; from?: string; to?: string }>({ query: (params) => ({ url: '/admin/audit-logs', params: { ...params, limit: 20 } }), transformResponse: (r: { data: Audit[]; meta: { totalPages: number } }) => ({ items: r.data, meta: r.meta }) }),
  exportAudit: build.mutation<string, { resource: 'audit-logs' | 'moderation'; from?: string; to?: string }>({ query: ({ resource, ...params }) => ({ url: `/admin/export/${resource}`, params, responseHandler: (r) => r.text() }) }),
}) });
export function AdminAuditPage() {
  const { ready } = useAdminSession(); const [page, setPage] = useState(1); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const filter = { ...(from ? { from: `${from}T00:00:00+07:00` } : {}), ...(to ? { to: `${to}T23:59:59.999+07:00` } : {}) };
  const query = api.useAuditListQuery({ page, ...filter }, { skip: !ready }); const [download, state] = api.useExportAuditMutation(); const [error, setError] = useState<string | null>(null);
  const exportFile = async (resource: 'audit-logs' | 'moderation') => { setError(null); try { const csv = await download({ resource, ...filter }).unwrap(); const url = URL.createObjectURL(new Blob(['\uFEFF', csv.replace(/^\uFEFF/, '')], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${resource}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { setError(adminError(e)); } };
  if (!ready) return null;
  return <AdminFrame title="Audit log và xuất báo cáo" description="Theo dõi thay đổi và lý do của các thao tác quản trị." error={query.error} loading={query.isLoading} refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
    <Feedback error={error} /><div className="flex flex-wrap items-end gap-3"><label>Từ ngày<input className="block rounded border p-2" type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} /></label><label>Đến ngày<input className="block rounded border p-2" type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} /></label><Button disabled={state.isLoading} onClick={() => void exportFile('audit-logs')}>Xuất audit CSV</Button><Button disabled={state.isLoading} onClick={() => void exportFile('moderation')}>Xuất kiểm duyệt CSV</Button></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Đối tượng</th><th>Thay đổi</th></tr></thead><tbody>{query.data?.items.map((r) => <tr className="border-t align-top" key={r.id}><td className="p-2">{new Date(r.createdAt).toLocaleString('vi-VN')}</td><td className="p-2">{r.action}<br /><small>{r.actorId}</small></td><td className="p-2">{r.targetType}<br />{r.targetId}</td><td className="p-2"><details><summary>Xem trước / sau và lý do</summary><pre className="max-w-lg overflow-auto whitespace-pre-wrap">{JSON.stringify(r.metadata, null, 2)}</pre></details></td></tr>)}</tbody></table></div>
    <div className="flex gap-3"><Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button><span>{page} / {query.data?.meta.totalPages ?? 1}</span><Button disabled={page >= (query.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
  </AdminFrame>;
}
