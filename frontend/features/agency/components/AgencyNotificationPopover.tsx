'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AgencyNotificationInbox } from './AgencyNotificationInbox';

export function AgencyNotificationPopover({ expanded, onClose }: { expanded: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input') ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); previous?.focus(); };
  }, []);
  return createPortal(<><button type="button" tabIndex={-1} aria-label="Đóng bảng thông báo" className="fixed inset-0 z-[55] cursor-default bg-slate-950/10" onClick={onClose} /><div ref={panel} role="dialog" aria-modal="true" aria-label="Thông báo Agency" className="fixed bottom-4 z-[60] max-h-[90dvh] w-[calc(100vw-32px)] max-w-[420px] overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 text-slate-900 shadow-2xl" style={{ left: `clamp(16px, ${expanded ? 312 : 88}px, calc(100vw - 436px))` }}>
    <AgencyNotificationInbox compact onClose={onClose} closeRef={close} />
  </div></>, document.body);
}
