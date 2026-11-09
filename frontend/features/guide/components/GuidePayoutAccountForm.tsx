'use client';
import { useState, type FormEvent } from 'react';
import type { UserProfile } from '@/features/auth/types';
import { useUpdateMeMutation } from '@/features/traveler-account/api/profileApi';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';

export function GuidePayoutAccountForm({ account }: { account?: UserProfile['bankAccount'] }) {
  const [update, { isLoading }] = useUpdateMeMutation();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [accountHolder, setHolder] = useState(account?.accountHolder ?? '');
  const [accountNumber, setNumber] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6,32}$/.test(accountNumber.trim())) { setError('Nhập đầy đủ số tài khoản từ 6 đến 32 chữ số.'); return; }
    setError('');
    try {
      await update({ bankAccount: { bankName: bankName.trim(), accountHolder: accountHolder.trim(), accountNumber: accountNumber.trim() } }).unwrap();
      setNumber(''); setEditing(false);
    } catch (err) { setError(getApiErrorMessage(err, 'Không thể lưu tài khoản nhận tiền.')); }
  };
  const remove = async () => {
    setError('');
    try { await update({ bankAccount: null }).unwrap(); setNumber(''); setEditing(false); }
    catch (err) { setError(getApiErrorMessage(err, 'Không thể xóa tài khoản nhận tiền.')); }
  };
  return <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
    <h2 className="font-semibold">Tài khoản nhận thù lao</h2>
    {account ? <p>{account.bankName} · {account.accountNumber} · {account.accountHolder}</p> : <p>Chưa đăng ký tài khoản ngân hàng.</p>}
    {!editing ? <div className="flex gap-3">
      <button type="button" onClick={() => { setBankName(account?.bankName ?? ''); setHolder(account?.accountHolder ?? ''); setNumber(''); setEditing(true); }} disabled={isLoading}>Cập nhật tài khoản nhận tiền</button>
      {account && <button type="button" disabled={isLoading} onClick={() => void remove()}>Xóa tài khoản nhận tiền</button>}
    </div> : <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label>Ngân hàng<input className="block w-full rounded border p-2" required minLength={2} maxLength={120} value={bankName} disabled={isLoading} onChange={(e) => setBankName(e.target.value)} /></label>
      <label>Tên người thụ hưởng<input className="block w-full rounded border p-2" required minLength={2} maxLength={120} value={accountHolder} disabled={isLoading} onChange={(e) => setHolder(e.target.value)} /></label>
      <label>Số tài khoản mới<input className="block w-full rounded border p-2" required type="password" autoComplete="off" inputMode="numeric" maxLength={32} value={accountNumber} disabled={isLoading} onChange={(e) => setNumber(e.target.value)} /></label>
      <p className="text-sm text-slate-500">Nhập lại đầy đủ số tài khoản khi cập nhật. Số đã lưu chỉ hiển thị bốn chữ số cuối.</p>
      <button type="submit" disabled={isLoading}>Lưu tài khoản nhận tiền</button>
      <button type="button" disabled={isLoading} onClick={() => { setNumber(''); setEditing(false); }}>Đóng</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
