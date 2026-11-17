'use client';

import { useId, useRef, useState } from 'react';
import { Modal } from 'antd';
import { useWalletActionMutation } from './walletApi';
import { errorText } from './FinanceUi';
import s from './Finance.module.css';

export interface SettlementBatchResult { settled: number; skipped: number; failed: number; alreadySettled: number; totalAmount: string }
export default function EarlySettlementDialog({ agencyId, onClose, onSuccess }: {
  agencyId: string; onClose: () => void; onSuccess: (result: SettlementBatchResult) => void;
}) {
  const [run, state] = useWalletActionMutation();
  const [error, setError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [result, setResult] = useState<SettlementBatchResult | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noteErrorId = useId();
  return <Modal title="Quyết toán ngay" open onCancel={state.isLoading ? undefined : onClose}
    closable={!state.isLoading} maskClosable={!state.isLoading} keyboard={!state.isLoading} footer={null} destroyOnClose>
    <form noValidate className={`${s.page} ${s.form}`} onSubmit={async event => {
      event.preventDefault();
      if (state.isLoading) return;
      const form = new FormData(event.currentTarget);
      setError('');
      setResult(null);
      const note = String(form.get('note') ?? '').trim();
      if (note.length < 3 || note.length > 1000) {
        setNoteError(!note ? 'Vui lòng nhập lý do quyết toán sớm.' : note.length < 3 ? 'Lý do cần ít nhất 3 ký tự.' : 'Lý do không được quá 1.000 ký tự.');
        noteRef.current?.focus();
        return;
      }
      setNoteError('');
      try {
        const response = await run({ url: `/admin/finance/settlements/${agencyId}/release-all`, body: { note }, timeout: 60000 }).unwrap();
        const outcome = response.data as SettlementBatchResult;
        if (outcome.settled > 0) onSuccess(outcome);
        else setResult(outcome);
      } catch (err) {
        setError((err as { status?: string })?.status === 'TIMEOUT_ERROR'
          ? 'Chưa nhận được kết quả quyết toán. Kiểm tra số dư trước khi thử lại.' : errorText(err));
      }
    }}>
      <div className={s.settlementIntro}>
        <p>Quyết toán toàn bộ khoản đủ điều kiện, không chờ 7 ngày.</p>
        <p className={s.muted}>Khoản tạm giữ hoặc chưa đủ điều kiện sẽ được bỏ qua.</p>
      </div>
      {state.isLoading && <p role="status" className={s.notice}>Đang kiểm tra và quyết toán các khoản đủ điều kiện…</p>}
      {result && <p role={result.failed ? 'alert' : 'status'} className={result.failed ? s.error : s.notice}>
        {result.failed ? `Chưa quyết toán được khoản nào. ${result.failed} khoản xử lý lỗi; vui lòng thử lại.`
          : result.skipped ? `Không có khoản đủ điều kiện quyết toán. ${result.skipped} khoản chưa đủ điều kiện hoặc đang tạm giữ.`
          : 'Agency không còn khoản chờ quyết toán.'}
      </p>}
      <div><label>Lý do quyết toán sớm<textarea ref={noteRef} name="note" required minLength={3} maxLength={1000} disabled={state.isLoading}
        aria-invalid={!!noteError} aria-describedby={noteError ? noteErrorId : undefined} onChange={() => { if (noteError) setNoteError(''); }}/></label>
        {noteError && <p id={noteErrorId} role="alert" className={s.fieldError}>{noteError}</p>}</div>
      {error && <p role="alert" className={s.error}>{error}</p>}
      <div className={s.actions}><button type="button" disabled={state.isLoading} onClick={onClose}>Hủy</button>
        <button type="submit" className={s.primary} disabled={state.isLoading}>{state.isLoading ? 'Đang quyết toán…' : 'Xác nhận quyết toán'}</button></div>
    </form>
  </Modal>;
}
