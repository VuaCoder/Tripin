'use client';

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { TourExtra } from '@travel-platform/constants';
import { Modal } from '@/components/ui/Modal';
import { TourServicesEditor } from './TourServicesEditor';
import { validateTourServices } from './tourEditorValidation';
import styles from './tour-services.module.css';

export function TourServicesField({ value, onChange, disabled = false }: {
  value: TourExtra[];
  onChange: (services: TourExtra[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<TourExtra[] | null>(null);
  const [error, setError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const headingId = useId();

  const close = () => {
    setDraft(null);
    setError(undefined);
    triggerRef.current?.focus();
  };
  const apply = (event: FormEvent<HTMLFormElement>) => {
    // Portals still bubble React events to the surrounding tour form.
    event.preventDefault();
    event.stopPropagation();
    if (!draft || disabled) return;
    const services: TourExtra[] = draft.map(service => ({ ...service, pricing: 'PER_PERSON', unit: 'người', active: true, maxQuantity: 100, ages: ['ADULT', 'CHILD', 'INFANT'] }));
    const issue = validateTourServices(services);
    if (issue || !event.currentTarget.checkValidity()) {
      setError(issue ?? 'Kiểm tra lại các trường dịch vụ được đánh dấu.');
      event.currentTarget.reportValidity();
      return;
    }
    onChange(services);
    close();
  };
  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (draft === null || event.key !== 'Tab') return;
    const dialog = (event.target as HTMLElement).closest('[role="dialog"]');
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'))
      .filter(control => !control.closest('details:not([open])') || control.tagName === 'SUMMARY');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <section className={styles.summarySection} aria-labelledby={headingId} onKeyDown={trapFocus}>
    <div className={styles.summaryHeading}>
      <div><h3 id={headingId}>Dịch vụ bổ sung <span className={styles.badge}>{value.length}/20</span></h3>
        <p>{value.length ? 'Khách chọn dịch vụ và người sử dụng khi đặt tour.' : 'Thêm dịch vụ khách có thể mua cùng tour.'}</p>
      </div>
      <button ref={triggerRef} type="button" disabled={disabled} className={styles.manageButton} aria-haspopup="dialog"
        onClick={() => { setDraft(structuredClone(value)); setError(undefined); }}>
        <SlidersHorizontal size={17} aria-hidden="true" />Quản lý dịch vụ
      </button>
    </div>
    {value.length > 0 && <p className={styles.summaryNames}>{value.slice(0, 3).map(service => service.name || 'Chưa đặt tên').join(' · ')}{value.length > 3 ? ` · +${value.length - 3} dịch vụ khác` : ''}</p>}
    <Modal open={draft !== null && !disabled} onClose={close} title="Quản lý dịch vụ bổ sung" className={`max-w-3xl ${styles.servicesModal}`} contentClassName={styles.modalContent} closeOnBackdrop={false}
      footer={<div className={styles.modalFooter}>
        <p>Lưu tour để hoàn tất thay đổi.</p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelButton} onClick={close}>Hủy</button>
          <button type="submit" form={formId} className={styles.applyButton}>Áp dụng dịch vụ</button>
        </div>
      </div>}>
      <form id={formId} noValidate onSubmit={apply}>
        {error && <p role="alert" className={styles.modalError}>{error}</p>}
        {draft !== null && <TourServicesEditor value={draft} onChange={services => { setDraft(services); setError(undefined); }} showTitle={false} />}
      </form>
    </Modal>
  </section>;
}
