import Link from 'next/link';
import type { UserProfile } from '@/features/auth/types';
import { AvatarPreview } from './AvatarPreview';

interface ProfileSummaryProps {
  user: UserProfile;
  onEdit: () => void;
}

export function ProfileSummary({ user, onEdit }: ProfileSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-md text-brand-ink">Thông tin cá nhân</h2>
        <button
          onClick={onEdit}
          className="px-4 py-2 text-sm font-semibold rounded-md border-2 border-brand-primary text-brand-primary hover:bg-brand-primary/5 transition-colors"
        >
          Chỉnh sửa
        </button>
      </div>

      <div className="flex items-center gap-6 pb-6 border-b border-brand-border">
        <AvatarPreview url={user.avatarUrl} name={user.fullName} />
        <div>
          <div className="text-lg font-bold text-brand-ink">{user.fullName}</div>
          <div className="text-sm text-brand-slate">{user.role}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-brand-slate mb-1">Email</div>
          <div className="text-brand-ink">{user.email} {user.emailVerifiedAt ? '(Đã xác minh)' : '(Chưa xác minh)'}</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-brand-slate mb-1">Số điện thoại</div>
          <div className="text-brand-ink">{user.phone || 'Chưa cập nhật'}</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-brand-slate mb-1">Ngày tham gia</div>
          <div className="text-brand-ink">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-brand-slate mb-1">Trạng thái tài khoản</div>
          <div className="text-brand-ink">
            {user.status === 'ACTIVE' ? <span className="text-brand-primary font-medium">Hoạt động</span> : user.status}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-brand-slate mb-1">Xác thực hai lớp (2FA)</div>
          <div className="flex items-center gap-3">
            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${user.twoFactorEnabled ? 'bg-[#EAFCFF] text-[#00636E]' : 'bg-surface-dim text-brand-slate'}`}>
              {user.twoFactorEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </span>
            <Link href="/traveler/settings/security" className="text-sm text-brand-primary hover:underline">
              Quản lý
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
