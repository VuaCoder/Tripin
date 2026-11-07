import Link from 'next/link';
import type { UserProfile } from '@/features/auth/types';
import { Badge, Button } from '@/components/ui';
import { OwnPremiumIdentity, OwnPremiumStatus, useOwnPremium } from '@/features/premium/PremiumIdentity';

interface ProfileSummaryProps {
  user: UserProfile;
  onEdit: () => void;
}

export function ProfileSummary({ user, onEdit }: ProfileSummaryProps) {
  const query = useOwnPremium(user.id);
  const isPremium = query.premium?.active;

  const joinedAt = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Thông tin cá nhân</h1>
        <Button onClick={onEdit} variant="outline" className="self-start sm:self-auto">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
          Chỉnh sửa
        </Button>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-surface-container bg-gradient-to-r from-surface-container-low to-white p-5 sm:flex-row sm:items-center sm:p-6">
        <OwnPremiumIdentity userId={user.id} url={user.avatarUrl} name={user.fullName} showStatus={false} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="truncate text-xl font-extrabold text-on-surface sm:text-2xl">{user.fullName}</span>
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-900 shadow-2xs">
                <span className="material-symbols-outlined text-[15px] text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                  workspace_premium
                </span>
                <span>Hội viên Premium</span>
                {query.premium?.endsAt && (
                  <span className="font-medium text-amber-700">
                    · Đến {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(query.premium.endsAt))}
                  </span>
                )}
              </span>
            )}
          </div>
          <OwnPremiumStatus userId={user.id}/>
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
          <p className="text-base font-bold text-on-surface">Ví voucher & Ưu đãi</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/vouchers"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          >
            Quản lý ví voucher
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-surface-container pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold text-on-surface">Xác thực hai lớp</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={user.twoFactorEnabled ? 'success' : 'default'}>
            {user.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}
          </Badge>
          <Link
            href="/settings/profile/security"
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
