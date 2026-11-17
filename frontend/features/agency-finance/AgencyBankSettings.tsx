'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Landmark, Check } from 'lucide-react';
import b from './BankSettings.module.css';
import { useAgencyContext } from '@/features/agency/agencyContext';
import { useFinanceBankQuery, useSaveFinanceBankMutation } from './financeApi';
import { FinanceError, errorText } from './FinanceUi';
import s from './Finance.module.css';

export default function AgencyBankSettings() {
  const ctx = useAgencyContext();
  // Remount the form when switching businesses; never carry bank input across Agencies.
  return <BankSettingsForm key={ctx?.agencyId ?? 'none'} agencyId={ctx?.agencyId ?? ''}
    canView={!!ctx?.permissions.includes('agency:finance-view')}
    canManage={!!ctx?.permissions.includes('agency:finance-bank-manage')} />;
}

function BankSettingsForm({ agencyId, canView, canManage }: { agencyId: string; canView: boolean; canManage: boolean }) {
  const bank = useFinanceBankQuery(agencyId, { skip: !agencyId || !canView, refetchOnMountOrArgChange: true });
  const [save, state] = useSaveFinanceBankMutation();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const data = bank.currentData;

  return <main className={`${s.page} ${s.screen}`}>
    <header className={s.header}><div><h1>Tài khoản nhận tiền</h1><p className={s.muted}>Lưu thông tin ngân hàng nhận tiền của Agency.</p></div></header>
    {!canView ? <p className={s.notice}>Bạn chưa có quyền xem tài khoản nhận tiền của Agency.</p>
      : bank.isError ? <FinanceError title="Không tải được tài khoản nhận tiền." onRetry={() => void bank.refetch()} />
      : bank.isFetching ? <p role="status">Đang tải thông tin…</p>
      : <section className={b.layout} aria-label="Thông tin tài khoản ngân hàng">
        {saved && <p className={`${s.notice} ${b.feedback}`} role="status">Đã lưu tài khoản nhận tiền.</p>}
        <div className={b.intro}><span className={b.bankIcon}><Landmark size={24} aria-hidden="true"/></span><h2>Thông tin ngân hàng</h2><p>Điền tài khoản dùng để nhận tiền của Agency.</p>{data&&<div className={b.savedAccount}><Check size={16} aria-hidden="true"/><span>Đã lưu {data.bankName}<strong>•••• {data.last4}</strong></span></div>}</div>
        <div className={b.fields}>
        <form className={s.form} onSubmit={async event => {
          event.preventDefault();
          if (state.isLoading || !canManage) return;
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          setError(''); setSaved(false);
          try {
            await save({ bankName: String(form.get('bankName')).trim(), accountHolder: String(form.get('accountHolder')).trim(),
              accountNumber: String(form.get('accountNumber')).trim(), expectedVersion: data?.version ?? 0 }).unwrap();
            setSaved(true); formElement.reset();
          } catch (err) { setError(errorText(err)); }
        }}>
          <label>Ngân hàng<input name="bankName" required minLength={2} maxLength={100} defaultValue={data?.bankName} placeholder="Ví dụ: Vietcombank" disabled={state.isLoading || !canManage} /></label>
          <label>Số tài khoản<input name="accountNumber" onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 30); }} required inputMode="numeric" pattern="[0-9]{6,30}" maxLength={30} autoComplete="off" placeholder={data ? "Nhập đầy đủ số tài khoản để cập nhật" : "Nhập số tài khoản ngân hàng"} disabled={state.isLoading || !canManage} /></label>
          <label>Tên chủ tài khoản<input name="accountHolder" required minLength={2} maxLength={150} defaultValue={data?.accountHolder} autoComplete="off" placeholder="Tên chủ tài khoản tại ngân hàng" disabled={state.isLoading || !canManage} /></label>
          {error && <p className={s.error} role="alert">{error}</p>}
          <div className={s.actions}>
            <button type="submit" className={s.primary} disabled={state.isLoading || !canManage}>{state.isLoading ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div>
        </form>
        {!canManage&&<p className={s.muted}>Bạn có quyền xem; chủ Agency hoặc người được cấp quyền có thể lưu tài khoản.</p>}
        <div className={b.footer}><Link href="/agency/finance" className={s.code}>Xem kế toán & tài chính</Link></div>
        </div>
      </section>}
  </main>;
}
