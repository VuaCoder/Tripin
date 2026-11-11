'use client';
import { Button } from '@/components/ui/Button';
import type { SecuritySettings } from '../types';

interface TwoFactorCardProps {
  settings: SecuritySettings;
  onToggle: (enable: boolean) => void;
}

export function TwoFactorCard({ settings, onToggle }: TwoFactorCardProps) {
  const isGoogleOnly = !settings.passwordConfigured && settings.googleLinked;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-surface-container bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-sm shadow-primary-container/20">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">shield_lock</span>
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-on-surface">Xác thực hai lớp</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-on-surface-variant">
            Bảo vệ tài khoản bằng mã OTP gửi qua email mỗi khi đăng nhập bằng mật khẩu.
          </p>
          {isGoogleOnly && (
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Tài khoản chỉ đăng nhập bằng Google nên email OTP không áp dụng.
            </p>
          )}
        </div>
      </div>

      {!isGoogleOnly && (
        <Button
          onClick={() => onToggle(!settings.twoFactorEnabled)}
          variant={settings.twoFactorEnabled ? 'outline' : 'primary'}
          className="shrink-0 self-start sm:self-auto"
        >
          {settings.twoFactorEnabled ? 'Tắt xác thực hai lớp' : 'Bật xác thực hai lớp'}
        </Button>
      )}
    </div>
  );
}
