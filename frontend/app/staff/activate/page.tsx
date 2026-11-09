'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Input } from '@/components/ui';
import { useActivateStaffMutation } from '@/features/admin/api/operationsApi';
import { adminError } from '@/features/admin/components/AdminUi';
function Activation() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  const [activate, state] = useActivateStaffMutation();
  return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-bold">Kích hoạt tài khoản nhân viên</h1>{state.isSuccess ? <><p>Tài khoản đã được kích hoạt.</p><Link href="/login">Đăng nhập</Link></> : <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (password !== confirm) { setError('Mật khẩu xác nhận chưa khớp.'); return; } try { await activate({ token, password }).unwrap(); } catch (e) { setError(adminError(e)); } }}>
    <p>Liên kết có hiệu lực 24 giờ và chỉ sử dụng một lần. Mật khẩu cần ít nhất 8 ký tự, có chữ và số.</p>{error && <p role="alert">{error}</p>}<label className="block">Mật khẩu mới<Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label><label className="block">Xác nhận mật khẩu<Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label><Button type="submit" loading={state.isLoading} disabled={!token}>Kích hoạt</Button>
  </form>}</main>;
}
export default function Page() { return <Suspense fallback={<p>Đang tải…</p>}><Activation /></Suspense>; }
