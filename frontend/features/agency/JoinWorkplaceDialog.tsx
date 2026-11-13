'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '@/store';
import { Modal } from '@/components/ui/Modal';
import { useJoinWorkplaceMutation, workplaceError, type JoinRequest } from './workplacesApi';
import styles from './Workplace.module.css';

export function JoinWorkplaceDialog({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (request: JoinRequest) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [join, state] = useJoinWorkplaceMutation();
  const store = useStore<RootState>();
  const mounted = useRef(true);
  const sending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const close = () => { if (!sending.current) onClose(); };
  return <Modal open title="Nhập mã mời" className="max-w-md" onClose={close} closeOnBackdrop={!state.isLoading}
    footer={<div className="flex justify-end gap-3"><button type="button" className={styles.button} disabled={state.isLoading} onClick={close}>Hủy</button><button type="submit" form="join-workplace-form" className={styles.primary} disabled={state.isLoading}>{state.isLoading ? 'Đang gửi…' : 'Gửi yêu cầu tham gia'}</button></div>}>
    <form id="join-workplace-form" className="space-y-5" onSubmit={async event => {
      event.preventDefault();
      if (sending.current) return;
      const normalized = code.replace(/[\s-]/g, '').toUpperCase();
      setError('');
      if (!/^[A-Z0-9]{12}$/.test(normalized)) { setError('Mã mời gồm 12 chữ cái hoặc chữ số. Vui lòng kiểm tra lại.'); return; }
      sending.current = true;
      const actorId = store.getState().auth.user?.id;
      const stillHere = () => mounted.current && store.getState().auth.user?.id === actorId;
      try {
        const result = await join(normalized).unwrap();
        if (stillHere()) onSubmitted(result);
      } catch (failure) { if (stillHere()) setError(workplaceError(failure)); }
      finally { sending.current = false; }
    }}>
      <p className="text-sm leading-6 text-slate-600">Nhập mã người quản lý chia sẻ. Bạn có thể vào doanh nghiệp sau khi yêu cầu được duyệt.</p>
      <div className={styles.field}><label htmlFor="join-workplace-code">Mã mời</label><input id="join-workplace-code" className={styles.code} autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={24} required value={code} disabled={state.isLoading} aria-invalid={Boolean(error)} aria-describedby={error ? 'join-code-help join-code-error' : 'join-code-help'} onChange={event => { setCode(event.target.value); setError(''); }} /><small id="join-code-help">Mã có hiệu lực 15 phút kể từ khi được tạo.</small></div>
      {error && <p id="join-code-error" role="alert" className={styles.error}>{error}</p>}
    </form>
  </Modal>;
}
