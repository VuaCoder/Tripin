'use client';
import { useState } from 'react';
import { LockKeyhole, LockKeyholeOpen, Mail, MailPlus, Trash2, UserRoundX } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { useDisableStaffMutation, useInviteStaffMutation, useReinviteStaffMutation, useUnbanUserMutation, useBanUserMutation, useDeleteAdminUserMutation } from '../api/operationsApi';
import type { AdminUser } from '../types';
import { adminError, Feedback } from './AdminUi';

export function InviteStaff() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(''); const [fullName, setName] = useState('');
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const [invite, state] = useInviteStaffMutation();
  return <div><Feedback error={null} success={success} /><Button onClick={() => { setError(null); setOpen(true); }}><MailPlus size={16} /> Mời nhân viên</Button><Modal open={open} title="Mời kiểm duyệt viên" onClose={() => { if (!state.isLoading) setOpen(false); }}>
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await invite({ email: email.trim(), fullName: fullName.trim() }).unwrap(); setOpen(false); setEmail(''); setName(''); setSuccess('Đã tạo lời mời. Thư kích hoạt có hiệu lực 24 giờ và sẽ được gửi qua email.'); } catch (e) { setError(adminError(e)); } }}>
      <Feedback error={error} /><label className="block">Họ tên<Input value={fullName} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></label>
      <label className="block">Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><Button type="submit" loading={state.isLoading}>Gửi lời mời</Button>
    </form></Modal></div>;
}

export function UserLifecycleAction({ target, iconOnly = false }: { target: AdminUser; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null);
  const [disable, ds] = useDisableStaffMutation();
  const [unban, us] = useUnbanUserMutation();
  const [ban, bs] = useBanUserMutation();
  const [reinvite, rs] = useReinviteStaffMutation(); const [resent, setResent] = useState(false);
  const staff = target.role === 'MODERATOR' || target.role === 'SUPER_ADMIN';

  // Nếu là staff đã disabled thì không thao tác tiếp
  if (staff && target.staffStatus === 'DISABLED') return null;
  if (!staff && target.status !== 'ACTIVE' && target.status !== 'BANNED') return null;

  // Xác định nhãn và loại hành động
  let actionType: 'disable_staff' | 'unban' | 'ban' = 'ban';
  let label = 'Khóa tài khoản';
  let icon = <UserRoundX size={15} />;

  if (staff) {
    actionType = 'disable_staff';
    label = 'Vô hiệu hóa nhân viên';
    icon = <UserRoundX size={15} />;
  } else if (target.status === 'BANNED') {
    actionType = 'unban';
    label = 'Mở khóa tài khoản';
    icon = <LockKeyholeOpen size={15} />;
  } else {
    actionType = 'ban';
    label = 'Khóa tài khoản';
    icon = <LockKeyhole size={15} />;
  }

  const isBusy = ds.isLoading || us.isLoading || bs.isLoading;

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (actionType === 'disable_staff') {
        await disable({ id: target.id, reason: reason.trim() }).unwrap();
      } else if (actionType === 'unban') {
        await unban({ id: target.id, reason: reason.trim() }).unwrap();
      } else {
        await ban({ id: target.id, reason: reason.trim() }).unwrap();
      }
      setOpen(false);
      setReason('');
    } catch (err) {
      setError(adminError(err));
    }
  };

  return (
    <>
      {target.staffStatus === 'INVITED' && (
        <Button
          size="sm"
          variant="ghost"
          disabled={rs.isLoading}
          title="Gửi lại lời mời"
          aria-label="Gửi lại lời mời"
          className={iconOnly ? '!size-9 !min-h-9 !p-0' : ''}
          onClick={async () => {
            try {
              await reinvite(target.id).unwrap();
              setResent(true);
              setError(null);
            } catch (err) {
              setError(adminError(err));
            }
          }}
        >
          <Mail size={15} />{iconOnly ? <span className="sr-only">Gửi lại lời mời</span> : ' Gửi lại lời mời'}
        </Button>
      )}
      {!open && error && <small role="alert" className="text-xs text-rose-600">{error}</small>}
      {resent && <small role="status" className="text-xs text-teal-600">Đã tạo lời mời mới; liên kết cũ hết hiệu lực.</small>}
      <Button
        size="sm"
        variant={actionType === 'unban' ? 'outline' : 'ghost'}
        className={`${actionType === 'ban' ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700' : ''} ${iconOnly ? '!size-9 !min-h-9 !p-0' : ''}`}
        aria-label={label}
        title={label}
        onClick={() => {
          setError(null);
          setReason('');
          setOpen(true);
        }}
      >
        {icon}
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </Button>
      <Modal open={open} title={label} onClose={() => { if (!isBusy) setOpen(false); }}>
        <form className="space-y-3" onSubmit={handleAction}>
          <p className="text-sm font-medium text-slate-700">{target.fullName} · {target.email}</p>
          <Feedback error={error} />
          <label className="block text-sm text-slate-700">
            Lý do (ít nhất 10 ký tự)
            <textarea
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm focus:border-teal-500 focus:outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={10}
              maxLength={1000}
              required
              rows={3}
              placeholder="Nhập lý do thực hiện thao tác..."
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" disabled={isBusy} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant={actionType === 'ban' ? 'primary' : 'primary'}
              loading={isBusy}
              disabled={reason.trim().length < 10}
              className={actionType === 'ban' ? '!bg-rose-600 hover:!bg-rose-700' : ''}
            >
              Xác nhận
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteUserAction({ target, iconOnly = false }: { target: AdminUser; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remove, state] = useDeleteAdminUserMutation();
  const staff = target.role === 'MODERATOR' || target.role === 'SUPER_ADMIN';
  if (staff) return null;

  return <>
    <Button size="sm" variant="ghost" className={`text-rose-600 hover:bg-rose-50 hover:text-rose-700 ${iconOnly ? '!size-9 !min-h-9 !p-0' : ''}`} aria-label="Xóa tài khoản" title="Xóa tài khoản" onClick={() => { setError(null); setConfirmEmail(''); setOpen(true); }}>
      <Trash2 size={15} />{iconOnly ? <span className="sr-only">Xóa tài khoản</span> : ' Xóa tài khoản'}
    </Button>
    <Modal open={open} title="Xóa tài khoản" onClose={() => { if (!state.isLoading) setOpen(false); }}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">Xác nhận xóa <strong>{target.fullName}</strong>. Tài khoản có dữ liệu đặt tour hoặc giao dịch cần lưu sẽ được hệ thống từ chối xóa để bảo toàn lịch sử.</p>
        <p className="text-sm text-slate-600">Nhập email tài khoản để xác nhận: <strong>{target.email}</strong></p>
        <Input aria-label="Email xác nhận xóa" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" />
        <Feedback error={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={state.isLoading} onClick={() => setOpen(false)}>Hủy</Button>
          <Button type="button" className="!bg-rose-600 hover:!bg-rose-700" disabled={state.isLoading || confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()} loading={state.isLoading} onClick={async () => {
            setError(null);
            try { await remove(target.id).unwrap(); setOpen(false); }
            catch (e) { setError(adminError(e)); }
          }}>Xóa tài khoản</Button>
        </div>
      </div>
    </Modal>
  </>;
}
