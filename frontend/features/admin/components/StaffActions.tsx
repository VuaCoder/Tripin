'use client';
import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { useDisableStaffMutation, useInviteStaffMutation, useReinviteStaffMutation, useUnbanUserMutation } from '../api/operationsApi';
import type { AdminUser } from '../types';
import { adminError, Feedback } from './AdminUi';

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(''); const [fullName, setName] = useState('');
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const [invite, state] = useInviteStaffMutation();
  return <div><Feedback error={null} success={success} /><Button onClick={() => { setError(null); setOpen(true); }}>Mời nhân viên</Button><Modal open={open} title="Mời kiểm duyệt viên" onClose={() => { if (!state.isLoading) setOpen(false); }}>
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await invite({ email: email.trim(), fullName: fullName.trim() }).unwrap(); setOpen(false); setEmail(''); setName(''); setSuccess('Đã tạo lời mời. Thư kích hoạt có hiệu lực 24 giờ và sẽ được gửi qua email.'); } catch (e) { setError(adminError(e)); } }}>
      <Feedback error={error} /><label className="block">Họ tên<Input value={fullName} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></label>
      <label className="block">Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><Button type="submit" loading={state.isLoading}>Gửi lời mời</Button>
    </form></Modal></div>;
}

export function UserLifecycleAction({ target }: { target: AdminUser }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null);
  const [disable, ds] = useDisableStaffMutation(); const [unban, us] = useUnbanUserMutation();
  const [reinvite, rs] = useReinviteStaffMutation(); const [resent, setResent] = useState(false);
  const staff = target.role === 'MODERATOR' || target.role === 'SUPER_ADMIN';
  if (staff ? target.staffStatus === 'DISABLED' : target.status !== 'BANNED') return null;
  const label = staff ? 'Vô hiệu hóa nhân viên' : 'Mở khóa tài khoản';
  return <>{target.staffStatus === 'INVITED' && <Button size="sm" variant="ghost" disabled={rs.isLoading} onClick={async () => { try { await reinvite(target.id).unwrap(); setResent(true); setError(null); } catch (e) { setError(adminError(e)); } }}>Gửi lại lời mời</Button>}{!open && error && <small role="alert">{error}</small>}{resent && <small role="status">Đã tạo lời mời mới; liên kết cũ hết hiệu lực.</small>}<Button size="sm" variant="outline" onClick={() => setOpen(true)}>{label}</Button><Modal open={open} title={label} onClose={() => { if (!ds.isLoading && !us.isLoading) setOpen(false); }}>
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await (staff ? disable : unban)({ id: target.id, reason: reason.trim() }).unwrap(); setOpen(false); } catch (e) { setError(adminError(e)); } }}>
      <p>{target.fullName} · {target.email}</p><Feedback error={error} /><label className="block">Lý do (ít nhất 10 ký tự)<textarea className="block w-full rounded border p-2" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={1000} required /></label><Button type="submit" loading={ds.isLoading || us.isLoading} disabled={reason.trim().length < 10}>Xác nhận</Button>
    </form></Modal></>;
}
