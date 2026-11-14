'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Map, Plus, Trash2 } from 'lucide-react';
import { itineraryCoveredDays, validateTourItinerary } from '@travel-platform/constants';
import { Modal } from '@/components/ui/Modal';
import type { TourItineraryDay } from '../types';
import styles from './tour-itinerary.module.css';

export function TourItineraryField({ id, value, duration, onChange, autoOpen = false, disabled = false }: {
  id?: string; value: TourItineraryDay[]; duration: number; onChange: (days: TourItineraryDay[]) => void; autoOpen?: boolean; disabled?: boolean;
}) {
  const [draft, setDraft] = useState<TourItineraryDay[] | null>(null);
  const [active, setActive] = useState(0);
  const [issue, setIssue] = useState<ReturnType<typeof validateTourItinerary>>();
  const trigger = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const formId = useId();
  const covered = itineraryCoveredDays(value, duration).length;
  const open = () => { setDraft(structuredClone(value)); setActive(0); setIssue(undefined); };
  useEffect(() => {
    if (autoOpen && !opened.current && !disabled) { opened.current = true; setDraft(structuredClone(value)); setActive(0); }
  }, [autoOpen, value, disabled]);
  const close = () => { setDraft(null); setIssue(undefined); trigger.current?.focus(); };
  useEffect(() => {
    if (draft === null || JSON.stringify(draft) === JSON.stringify(value)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, value]);
  const update = (patch: Partial<TourItineraryDay>) => { setDraft(current => current?.map((d, i) => i === active ? { ...d, ...patch } : d) ?? null); setIssue(undefined); };
  const add = () => {
    if (!draft) return;
    const coveredDays = itineraryCoveredDays(draft, duration);
    const next = Array.from({ length: duration }, (_, i) => i + 1).find(d => !coveredDays.includes(d));
    if (!next) return;
    setDraft([...draft, { day: next, title: '', description: '', activities: [] }]); setActive(draft.length); setIssue(undefined);
    requestAnimationFrame(() => editor.current?.querySelector<HTMLInputElement>('[data-title]')?.focus());
  };
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!draft || disabled) return;
    const normalized = draft.map(d => ({ ...d, activities: d.activities.map(a => a.trim()).filter(Boolean) }));
    const error = validateTourItinerary(normalized, duration);
    if (error) {
      setIssue(error); if (error.index !== undefined) setActive(error.index);
      requestAnimationFrame(() => editor.current?.querySelector<HTMLElement>(`[data-field="${error.field ?? 'day'}"]`)?.focus());
      return;
    }
    onChange([...normalized].sort((a, b) => a.day - b.day).map(d => ({ ...d, title: d.title.trim(), toDay: d.toDay === d.day ? undefined : d.toDay })));
    close();
  };
  const trap = (event: KeyboardEvent<HTMLElement>) => {
    const dialog = (event.target as HTMLElement).closest('[role="dialog"]');
    if (!dialog || draft === null) return;
    // The portal must not inherit Enter-to-next-field behavior from the onboarding form.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary')].filter(el => !el.closest('details:not([open])') || el.tagName === 'SUMMARY');
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const selected = draft?.[active];
  const errorProps = (field: 'day' | 'title' | 'description' | 'activities') => ({ 'data-field': field, 'aria-invalid': issue?.index === active && issue.field === field, 'aria-describedby': issue?.index === active && issue.field === field ? `${formId}-error` : undefined });
  const validDuration = Number.isInteger(duration) && duration > 0 && duration <= 365;

  return <section className={styles.field} aria-label="Lịch trình tour" onKeyDown={trap}>
    <div className={styles.fieldHead}>
      <div><h3>Lịch trình tour</h3><p>{covered}/{validDuration ? duration : '—'} ngày đã có chương trình</p></div>
      <button id={id} ref={trigger} type="button" className={styles.secondary} disabled={disabled || !validDuration} aria-haspopup="dialog" onClick={open}><Map size={17} aria-hidden="true" />Soạn lịch trình</button>
    </div>
    {value.length > 0 && <p className={styles.preview}>{value.slice(0, 2).map(d => `Ngày ${d.day}${d.toDay && d.toDay > d.day ? `–${d.toDay}` : ''}: ${d.title}`).join(' · ')}{value.length > 2 ? ` · +${value.length - 2} mục khác` : ''}</p>}
    <Modal open={draft !== null && !disabled} onClose={close} title="Soạn lịch trình tour" className={`max-w-4xl ${styles.modal}`} contentClassName={styles.body} closeOnBackdrop={false}
      footer={<div className={styles.footer}><p>Áp dụng vào form. Lưu tour để hoàn tất.</p><div><button type="button" className={styles.secondary} onClick={close}>Hủy</button><button type="submit" form={formId} className={styles.primary}>Áp dụng lịch trình</button></div></div>}>
      <form id={formId} noValidate onSubmit={apply}>
        <div className={styles.toolbar}><p>{itineraryCoveredDays(draft ?? [], duration).length}/{duration} ngày · Có thể gộp ngày có cùng chương trình.</p><button type="button" className={styles.secondary} disabled={!validDuration || (draft?.length ?? 0) >= 365 || itineraryCoveredDays(draft ?? [], duration).length >= duration} onClick={add}><Plus size={16} aria-hidden="true" />Thêm ngày</button></div>
        {issue && <p id={`${formId}-error`} className={styles.error} role="alert">{issue.message}</p>}
        {!draft?.length ? <div className={styles.empty}><Map size={28} aria-hidden="true" /><h3>Chuyến đi bắt đầu như thế nào?</h3><p>Thêm ngày đầu tiên để mô tả nơi tham quan và các hoạt động.</p><button type="button" className={styles.primary} onClick={add}>Thêm ngày đầu tiên</button></div> : <div className={styles.layout}>
          <nav className={styles.days} aria-label="Các ngày trong lịch trình">{draft.map((d, i) => <button key={i} type="button" aria-pressed={active === i} onClick={() => { setActive(i); setIssue(undefined); }}><strong>Ngày {d.day}{d.toDay && d.toDay > d.day ? `–${d.toDay}` : ''}</strong><span>{d.title || 'Chưa có tiêu đề'}</span></button>)}</nav>
          {selected && <div className={styles.editor} ref={editor} key={active}>
            <div className={styles.editorHead}><h3>Nội dung chương trình</h3><button type="button" className={styles.remove} onClick={() => { setDraft(draft.filter((_, i) => i !== active)); setActive(Math.max(0, active - 1)); setIssue(undefined); }}><Trash2 size={16} aria-hidden="true" />Xóa ngày</button></div>
            <div className={styles.range}><label>Ngày bắt đầu<input {...errorProps('day')} type="number" min={1} max={duration} value={Number.isFinite(selected.day) ? selected.day : ''} onChange={e => update({ day: e.target.valueAsNumber })} /></label><label>Đến ngày (nếu gộp)<input type="number" min={selected.day} max={duration} placeholder="Không gộp" value={selected.toDay ?? ''} onChange={e => update({ toDay: e.target.value === '' ? undefined : e.target.valueAsNumber })} /></label></div>
            <label>Tiêu đề ngày<input {...errorProps('title')} data-title required minLength={2} maxLength={200} value={selected.title} placeholder="Ví dụ: Đón khách – Khám phá phố cổ" onChange={e => update({ title: e.target.value })} /></label>
            <label>Nội dung chi tiết<textarea {...errorProps('description')} rows={6} maxLength={5000} value={selected.description ?? ''} placeholder="Các điểm đến, hoạt động và bữa ăn trong ngày…" onChange={e => update({ description: e.target.value })} /></label>
            <details open={!!selected.activities.length}><summary>Hoạt động riêng (không bắt buộc)</summary><label>Danh sách hoạt động<textarea {...errorProps('activities')} rows={3} value={selected.activities.join('\n')} placeholder="Mỗi dòng một hoạt động" onChange={e => update({ activities: e.target.value.split('\n') })} /></label></details>
          </div>}
        </div>}
      </form>
    </Modal>
  </section>;
}
