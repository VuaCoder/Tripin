'use client';
import { PolicyHistory } from './PolicyHistory';
import { FormSelect } from '@/components/ui/FormSelect';
import { useState } from 'react';
import { Edit3, History } from 'lucide-react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { useGetAdminPoliciesQuery, useSetAdminPolicyMutation } from '../api/adminApi';
import { POLICY_KEYS, type Policy, type PolicyInput } from '../types';
import { policyError } from '../validation';
import { AdminFrame, Feedback, adminError, control, forbidden, panel, timestamp, toolbar, useAdminSession } from './AdminUi';
import { normalizedSearch } from '../utils/filters';
import { AdminPoliciesSkeleton } from './AdminSkeletons';

type ParamRow = { id: number; name: string; type: 'number' | 'string' | 'boolean'; value: string };
const labels = { cancellation: 'Chính sách hủy', refund: 'Chính sách hoàn tiền', terms: 'Điều khoản dịch vụ', privacy: 'Chính sách riêng tư', moderation: 'SLA kiểm duyệt' };
const paramLabels: Record<string, string> = { cancellationWindowHours: 'Khách có thể hủy trước giờ khởi hành', milestonesJson: 'Mức hoàn tiền theo thời điểm hủy', slaHours: 'Thời gian xử lý báo cáo', escalationSlaHours: 'Thời hạn ưu tiên báo cáo khẩn' };
const displayParam = (name: string, value: string | number | boolean) => {
  if (name === 'milestonesJson') {
    try { return (JSON.parse(String(value)) as { daysBefore: number; percent: number }[]).map((item) => `Hủy trước ${item.daysBefore} ngày: hoàn ${item.percent}%`).join(' · '); }
    catch { return 'Chưa thiết lập mốc hoàn tiền hợp lệ'; }
  }
  if (name === 'cancellationWindowHours') return `${value} giờ trước khởi hành`;
  if (name === 'slaHours') return `Trong ${value} giờ`;
  if (name === 'escalationSlaHours') return `Trong ${value} giờ kể từ khi tiếp nhận`;
  return String(value);
};
function PolicyForm({ policy, busy, serverError, onSave, onClose, onReload }: { policy: Policy; busy: boolean; serverError: string | null; onSave: (body: PolicyInput) => void; onClose: () => void; onReload: () => void }) {
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState(policy.title);
  const [content, setContent] = useState(policy.content);
  const [rows, setRows] = useState<ParamRow[]>(Object.entries(policy.params).map(([name, rawValue], id) => {
    let value = String(rawValue);
    if (name === 'milestonesJson') {
      try { value = (JSON.parse(value) as { daysBefore: number; percent: number }[]).map((item) => `${item.daysBefore}:${item.percent}`).join(', '); } catch { /* keep saved value so it can be repaired */ }
    }
    return { id, name, type: typeof rawValue as ParamRow['type'], value };
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (id: number, patch: Partial<ParamRow>) => setRows((current) => current.map((r) => r.id === id ? { ...r, ...patch } : r));
  const submit = () => {
    if (busy) return;
    if (new Set(rows.map((r) => r.name)).size !== rows.length) { setError('Tên tham số không được trùng.'); return; }
    if (rows.some((r) => r.name !== 'milestonesJson' && r.type === 'number' && !r.value.trim())) { setError('Vui lòng điền đầy đủ mốc thời gian.'); return; }
    let params: PolicyInput['params'];
    try {
      params = Object.fromEntries(rows.map((r) => [r.name, r.name === 'milestonesJson'
        ? JSON.stringify(r.value.split(',').map((part) => { const [daysBefore, percent] = part.trim().split(':').map(Number); if (!Number.isFinite(daysBefore) || !Number.isFinite(percent) || daysBefore < 0 || percent < 0 || percent > 100) throw new Error(); return { daysBefore, percent }; }))
        : r.type === 'number' ? Number(r.value) : r.type === 'boolean' ? r.value === 'true' : r.value]));
    } catch { setError('Nhập mốc hoàn tiền theo dạng “số ngày: phần trăm”, ví dụ 7:100, 3:50, 0:0.'); return; }
    if (reason.trim().length < 10) { setError('Lý do cần ít nhất 10 ký tự.'); return; }
    const body: PolicyInput = { expectedVersion: policy.version ?? 0, reason: reason.trim(), ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom).toISOString() } : {}), title: title.trim(), content, params };
    const found = policyError(policy.key, body); setError(found); if (!found) onSave(body);
  };
  return <Modal open title={`Cấu hình ${labels[policy.key].toLowerCase()}`} className="max-h-[90vh] max-w-3xl overflow-y-auto" closeOnBackdrop={!busy} onClose={onClose}>
    <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Feedback error={error || serverError} />
      {serverError && <Button variant="outline" onClick={onReload}>Nạp lại dữ liệu (bỏ bản nháp)</Button>}
      <label className="block">Có hiệu lực từ (để trống: ngay lập tức)<input className="block rounded border p-2" type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></label>
      <FormField label="Lý do thay đổi" htmlFor="policy-reason" required><Input id="policy-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      <FormField label="Tiêu đề" htmlFor="policy-title" required><Input id="policy-title" value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></FormField>
      <FormField label="Nội dung chính sách" htmlFor="policy-content" hint="Lưu trực tiếp nội dung văn bản/Markdown. Có thể chọn thời điểm có hiệu lực."><textarea id="policy-content" className={control} rows={8} value={content} maxLength={50000} disabled={busy} onChange={(e) => setContent(e.target.value)} /></FormField>
      <fieldset disabled={busy} className="space-y-3"><legend className="font-bold">Cách áp dụng</legend>
        {rows.map((r) => {
          return <FormField key={r.id} label={paramLabels[r.name] ?? 'Thời gian áp dụng (giờ)'} htmlFor={`param-value-${r.id}`} hint={r.name === 'milestonesJson' ? 'Nhập các mốc dạng ngày:phần trăm, ví dụ 7:100, 3:50, 0:0.' : undefined}><Input id={`param-value-${r.id}`} value={r.value} inputMode={r.name === 'milestonesJson' ? 'text' : 'numeric'} onChange={(e) => set(r.id, { value: e.target.value })} /></FormField>;
        })}
      </fieldset>
      <p className="text-xs text-slate-500">Lưu sẽ thay thế nội dung và toàn bộ tham số của chính sách này. Booking và khiếu nại đã tạo giữ snapshot chính sách đã chốt.</p>
      <div className="flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy}>Lưu chính sách</Button></div>
    </form>
  </Modal>;
}
export function AdminPoliciesPage() {
  const { ready } = useAdminSession();
  const [history, setHistory] = useState<Policy | null>(null);
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
  return <AdminFrame title="Chính sách hệ thống" description="Chính sách có lịch sử phiên bản và thời điểm có hiệu lực. Nội dung công khai; chỉ Super Admin được cập nhật." error={denied || query.error} loading={!query.currentData} loadingSkeleton={<AdminPoliciesSkeleton />} refreshing={query.isFetching && !!query.currentData} onRefresh={() => query.refetch()}>
    <Feedback error={!editing ? error : null} success={success} />
    <div className={`${toolbar} sm:grid-cols-[2fr_1fr_auto]`}><FormField label="Tìm chính sách" htmlFor="policy-search"><Input id="policy-search" value={search} placeholder="Tên hoặc nội dung chính sách..." onChange={(e) => setSearch(e.target.value)} /></FormField><FormField label="Loại chính sách" htmlFor="policy-filter"><FormSelect id="policy-filter" className={control} value={policyFilter} onChange={(e) => setPolicyFilter(e.target.value)}><option value="all">Tất cả chính sách</option>{POLICY_KEYS.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</FormSelect></FormField><Button variant="ghost" onClick={() => { setSearch(''); setPolicyFilter('all'); }}>Đặt lại</Button></div>
    {!visibleKeys.length && <p className={`${panel} text-center text-sm text-slate-500`}>Không có chính sách phù hợp.</p>}
    <div className="grid gap-4 md:grid-cols-2">{visibleKeys.map((key) => {
      const p = query.currentData?.find((item) => item.key === key);
      return p ? <section className={panel} key={key}><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{labels[key]}</h2><p className="mt-1 text-xs text-slate-500">Cập nhật: {timestamp(p.updatedAt)}</p></div><div className="flex shrink-0 items-center gap-1"><Button variant="outline" size="sm" aria-label={`Sửa ${labels[key].toLowerCase()}`} title={`Sửa ${labels[key].toLowerCase()}`} disabled={isLoading || query.isFetching} onClick={() => { setError(null); setSuccess(null); setEditing(p); }} className="flex items-center gap-1.5"><Edit3 size={15} /><span>Sửa</span></Button><Button variant="ghost" size="sm" aria-label="Lịch sử / khôi phục" title="Lịch sử / khôi phục" onClick={() => setHistory(p)} className="flex items-center gap-1.5"><History size={15} /><span>Lịch sử</span></Button></div></div><h3 className="mt-4 font-semibold">{p.title}</h3><p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-700">{p.content || 'Chưa có nội dung.'}</p><dl className="my-4 space-y-2">{Object.entries(p.params).map(([name, value]) => <div key={name} className="text-sm"><dt className="font-medium text-slate-600">{paramLabels[name] ?? 'Cách áp dụng'}</dt><dd className="mt-0.5 text-slate-900">{displayParam(name, value)}</dd></div>)}</dl></section> : <section key={key} className={panel}><h2>{labels[key]}</h2><p role="alert">Không tải được chính sách này. Hãy thử tải lại.</p></section>;
    })}</div>
    {history && <PolicyHistory policy={history} onClose={() => setHistory(null)} />}
    {editing && <PolicyForm policy={editing} busy={isLoading} serverError={error} onReload={() => { setEditing(null); setError(null); void query.refetch(); }} onSave={(body) => void submit(body)} onClose={() => { if (!isLoading) setEditing(null); }} />}
  </AdminFrame>;
}
