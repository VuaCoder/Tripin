import Link from 'next/link';
import type { UserProfile } from '@/features/auth/types';
import { Badge, Button } from '@/components/ui';
import { AvatarPreview } from './AvatarPreview';

interface ProfileSummaryProps {
  user: UserProfile;
  onEdit: () => void;
}

export function ProfileSummary({ user, onEdit }: ProfileSummaryProps) {
  const joinedAt = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Hồ sơ Traveler</p>
          <h2 className="mt-1 text-headline-md font-bold text-on-surface">Thông tin cá nhân</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Thông tin được dùng cho tài khoản và các giao dịch của bạn.</p>
        </div>
        <Button onClick={onEdit} variant="outline" className="self-start">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
          Chỉnh sửa
        </Button>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-surface-container bg-gradient-to-r from-surface-container-low to-white p-5 sm:flex-row sm:items-center sm:p-6">
        <AvatarPreview url={user.avatarUrl} name={user.fullName} />
        <div className="min-w-0">
          <div className="truncate text-xl font-extrabold text-on-surface sm:text-2xl">{user.fullName}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">Traveler</Badge>
            <Badge variant={user.emailVerifiedAt ? 'success' : 'warning'}>
              {user.emailVerifiedAt ? 'Email đã xác minh' : 'Email chưa xác minh'}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <ProfileDetail icon="mail" label="Email" value={user.email} />
        <ProfileDetail icon="call" label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} muted={!user.phone} />
        <ProfileDetail icon="calendar_month" label="Ngày tham gia" value={joinedAt} />
        <ProfileDetail icon="verified_user" label="Trạng thái tài khoản" value={user.status === 'ACTIVE' ? 'Đang hoạt động' : user.status} />
      </dl>

      <div className="flex flex-col gap-4 border-t border-surface-container pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">Xác thực hai lớp</p>
          <p className="mt-1 text-sm text-on-surface-variant">Bảo vệ đăng nhập bằng mã OTP gửi qua email.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={user.twoFactorEnabled ? 'success' : 'default'}>
            {user.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}
          </Badge>
          <Link
            href="/traveler/settings/security"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          >
            Quản lý
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProfileDetail({ icon, label, value, muted = false }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</dt>
        <dd className={`mt-1 break-words text-sm font-semibold ${muted ? 'text-slate-400' : 'text-on-surface'}`}>{value}</dd>
      </div>
    </div>
  );
}
