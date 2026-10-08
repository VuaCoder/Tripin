'use client';
import { Badge, Button } from '@/components/ui';
import type { SecuritySettings } from '../types';

interface TwoFactorCardProps {
  settings: SecuritySettings;
  onToggle: (enable: boolean) => void;
}

export function TwoFactorCard({ settings, onToggle }: TwoFactorCardProps) {
  const isGoogleOnly = !settings.passwordConfigured && settings.googleLinked;

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-container bg-white">
      <div className="flex flex-col gap-5 bg-gradient-to-br from-surface-container-low/80 to-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-sm shadow-primary-container/20">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">shield_lock</span>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-on-surface">Xác thực hai lớp</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-on-surface-variant">
            Bảo vệ tài khoản bằng mã OTP gửi qua email mỗi khi đăng nhập bằng mật khẩu.
            </p>
          </div>
        </div>
        <Badge variant={settings.twoFactorEnabled ? 'success' : 'default'} className="self-start">
          {settings.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}
        </Badge>
      </div>

      <div className="border-t border-surface-container p-5 sm:p-6">
        {isGoogleOnly ? (
          <div className="flex gap-3 rounded-xl border border-primary-container/15 bg-primary-fixed/45 p-4 text-sm leading-6 text-on-primary-fixed">
            <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary" aria-hidden="true">info</span>
            <p>
              Tài khoản này chỉ đăng nhập bằng Google và chưa có mật khẩu. Google đã bảo vệ phiên đăng nhập, nên email OTP 2FA không áp dụng cho phương thức này.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-6 text-on-surface-variant">
              {settings.twoFactorEnabled
                ? 'Mã xác thực sẽ được gửi tới email của bạn mỗi khi đăng nhập.'
                : 'Bật tính năng này để tăng cường bảo mật cho tài khoản.'}
            </div>
            <Button
              onClick={() => onToggle(!settings.twoFactorEnabled)}
              variant={settings.twoFactorEnabled ? 'outline' : 'primary'}
              className="shrink-0"
            >
              {settings.twoFactorEnabled ? 'Tắt 2FA' : 'Bật xác thực hai lớp'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
