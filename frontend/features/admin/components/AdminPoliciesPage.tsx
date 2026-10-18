'use client';
import { useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useGetAdminPoliciesQuery, useSetAdminPolicyMutation } from '../api/adminApi';
import { POLICY_KEYS, type Policy, type PolicyInput } from '../types';
import { policyError } from '../validation';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, timestamp, toolbar, useAdminSession } from './AdminUi';
import { normalizedSearch } from '../utils/filters';

type ParamRow = { id: number; name: string; type: 'number' | 'string' | 'boolean'; value: string };
const labels = { cancellation: 'Chính sách hủy', refund: 'Chính sách hoàn tiền', terms: 'Điều khoản dịch vụ', privacy: 'Chính sách riêng tư' };
function PolicyForm({ policy, busy, serverError, onSave, onClose }: { policy: Policy; busy: boolean; serverError: string | null; onSave: (body: PolicyInput) => void; onClose: () => void }) {
  const [title, setTitle] = useState(policy.title);
  const [content, setContent] = useState(policy.content);
  const [rows, setRows] = useState<ParamRow[]>(Object.entries(policy.params).map(([name, value], id) => ({ id, name, type: typeof value as ParamRow['type'], value: String(value) })));
  const [nextId, setNextId] = useState(rows.length);
  const [error, setError] = useState<string | null>(null);
  const set = (id: number, patch: Partial<ParamRow>) => setRows((current) => current.map((r) => r.id === id ? { ...r, ...patch } : r));
  const submit = () => {
    if (busy) return;
    if (new Set(rows.map((r) => r.name)).size !== rows.length) { setError('Tên tham số không được trùng.'); return; }
    if (rows.some((r) => r.type === 'number' && !r.value.trim())) { setError('Tham số số không được để trống.'); return; }
    const body: PolicyInput = { title: title.trim(), content, params: Object.fromEntries(rows.map((r) => [r.name, r.type === 'number' ? Number(r.value) : r.type === 'boolean' ? r.value === 'true' : r.value])) };
    const found = policyError(policy.key, body); setError(found); if (!found) onSave(body);
  };
  return <Modal open title={`Cấu hình ${labels[policy.key].toLowerCase()}`} className="max-h-[90vh] max-w-3xl overflow-y-auto" closeOnBackdrop={!busy} onClose={onClose}>
    <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Feedback error={error || serverError} />
      <FormField label="Tiêu đề" htmlFor="policy-title" required><Input id="policy-title" value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></FormField>
      <FormField label="Nội dung chính sách" htmlFor="policy-content" hint="Lưu trực tiếp nội dung văn bản/Markdown. Không có bước xuất bản riêng."><textarea id="policy-content" className={control} rows={8} value={content} maxLength={50000} disabled={busy} onChange={(e) => setContent(e.target.value)} /></FormField>
      <fieldset disabled={busy} className="space-y-3"><legend className="font-bold">Tham số hệ thống</legend>
        {rows.map((r) => {
          const cancellation = policy.key === 'cancellation' && r.name === 'cancellationWindowHours';
          return <div key={r.id} className="grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_100px_1fr_auto]">
            <FormField label={cancellation ? 'Tham số thời hạn hủy (giờ)' : 'Tên tham số'} htmlFor={`param-name-${r.id}`}><Input id={`param-name-${r.id}`} value={r.name} readOnly={cancellation} onChange={(e) => set(r.id, { name: e.target.value })} /></FormField>
            <FormField label="Kiểu" htmlFor={`param-type-${r.id}`}><select id={`param-type-${r.id}`} className={control} value={r.type} disabled={cancellation} onChange={(e) => { const type = e.target.value as ParamRow['type']; set(r.id, { type, value: type === 'boolean' ? 'false' : '' }); }}><option value="number">Số</option><option value="string">Chữ</option><option value="boolean">Boolean</option></select></FormField>
            <FormField label={cancellation ? 'Thời hạn hủy (giờ)' : 'Giá trị'} htmlFor={`param-value-${r.id}`}>{r.type === 'boolean' ? <select id={`param-value-${r.id}`} className={control} value={r.value} onChange={(e) => set(r.id, { value: e.target.value })}><option value="true">true</option><option value="false">false</option></select> : <Input id={`param-value-${r.id}`} value={r.value} inputMode={r.type === 'number' ? 'decimal' : 'text'} onChange={(e) => set(r.id, { value: e.target.value })} />}</FormField>
            {!cancellation && <Button variant="ghost" aria-label={`Xóa tham số ${r.name || r.id}`} onClick={() => setRows((current) => current.filter((row) => row.id !== r.id))}>Xóa</Button>}
          </div>;
        })}
        <Button variant="outline" disabled={rows.length >= 30} onClick={() => { setRows([...rows, { id: nextId, name: '', type: 'string', value: '' }]); setNextId(nextId + 1); }}>Thêm tham số</Button>
      </fieldset>
      <p className="text-xs text-slate-500">Lưu sẽ thay thế nội dung và toàn bộ tham số của chính sách này. Các module dùng tham số sẽ đọc cấu hình mới.</p>
      <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy}>Lưu chính sách</Button></div>
    </form>
  </Modal>;
}
export function AdminPoliciesPage() {
  const { ready } = useAdminSession();
  const [search, setSearch] = useState('');
  const [policyFilter, setPolicyFilter] = useState('all');
  const query = useGetAdminPoliciesQuery(undefined, { skip: !ready, refetchOnMountOrArgChange: true });
  const [save, { isLoading }] = useSetAdminPolicyMutation();
  const [editing, setEditing] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState<unknown>();
  const submit = async (body: PolicyInput) => {
    if (!editing || isLoading) return; setError(null); setSuccess(null);
    try { const result = await save({ key: editing.key, body }).unwrap(); setEditing(null); setSuccess(`Đã lưu ${labels[result.key].toLowerCase()}.`); } catch (e) { setError(adminError(e)); if (forbidden(e)) setDenied(e); }
  };
  const visibleKeys = POLICY_KEYS.filter((key) => {
    const p = query.currentData?.find((item) => item.key === key);
    return (policyFilter === 'all' || policyFilter === key) && normalizedSearch(`${labels[key]} ${p?.title ?? ''} ${p?.content ?? ''}`).includes(normalizedSearch(search));
  });
  if (!ready) return null;
  return <AdminFrame title="Chính sách hệ thống" description="Bốn chính sách được lưu trực tiếp theo backend. Nội dung công khai; chỉ Super Admin được cập nhật." error={denied || query.error} loading={!query.currentData} refreshing={query.isFetching && !!query.currentData} onRefresh={() => void query.refetch()}>
    <Feedback error={!editing ? error : null} success={success} />
    <div className={`${toolbar} sm:grid-cols-[2fr_1fr_auto]`}><FormField label="Tìm chính sách" htmlFor="policy-search"><Input id="policy-search" value={search} placeholder="Tên hoặc nội dung chính sách..." onChange={(e) => setSearch(e.target.value)} /></FormField><FormField label="Loại chính sách" htmlFor="policy-filter"><select id="policy-filter" className={control} value={policyFilter} onChange={(e) => setPolicyFilter(e.target.value)}><option value="all">Tất cả chính sách</option>{POLICY_KEYS.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select></FormField><Button variant="ghost" onClick={() => { setSearch(''); setPolicyFilter('all'); }}>Đặt lại</Button></div>
    {!visibleKeys.length && <p className={`${panel} text-center text-sm text-slate-500`}>Không có chính sách phù hợp.</p>}
    <div className="grid gap-4 md:grid-cols-2">{visibleKeys.map((key) => {
      const p = query.currentData?.find((item) => item.key === key);
      return p ? <section className={panel} key={key}><h2 className="font-bold">{labels[key]}</h2><p className="mt-1 text-xs text-slate-500">{timestamp(p.updatedAt)}</p><h3 className="mt-4 font-semibold">{p.title}</h3><p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-700">{p.content || 'Chưa có nội dung.'}</p><dl className="my-4 space-y-1">{Object.entries(p.params).map(([name, value]) => <div key={name} className="break-all text-xs"><dt className="inline font-semibold">{name}: </dt><dd className="inline">{String(value)} ({typeof value})</dd></div>)}</dl><Button variant="outline" disabled={isLoading || query.isFetching} onClick={() => { setError(null); setSuccess(null); setEditing(p); }}>Sửa {labels[key].toLowerCase()}</Button></section> : <section key={key} className={panel}><h2>{labels[key]}</h2><p role="alert">Backend chưa trả chính sách này. Hãy tải lại dữ liệu.</p></section>;
    })}</div>
    {editing && <PolicyForm policy={editing} busy={isLoading} serverError={error} onSave={(body) => void submit(body)} onClose={() => { if (!isLoading) setEditing(null); }} />}
  </AdminFrame>;
}
