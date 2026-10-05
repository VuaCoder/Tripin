'use client';
import type { SecuritySettings } from '../types';

interface TwoFactorCardProps {
  settings: SecuritySettings;
  onToggle: (enable: boolean) => void;
}

export function TwoFactorCard({ settings, onToggle }: TwoFactorCardProps) {
  const isGoogleOnly = !settings.passwordConfigured && settings.googleLinked;

  return (
    <div className="p-6 rounded-lg border border-brand-border bg-surface-bright space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-ink">Xác thực hai lớp (2FA)</h3>
          <p className="text-sm text-brand-slate mt-1">
            Bảo vệ tài khoản bằng mã OTP gửi qua email mỗi khi đăng nhập bằng mật khẩu.
          </p>
        </div>
        <div className={`px-3 py-1 text-xs font-bold rounded-full ${settings.twoFactorEnabled ? 'bg-[#EAFCFF] text-[#00636E]' : 'bg-surface-dim text-brand-slate'}`}>
          {settings.twoFactorEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </div>
      </div>

      <div className="pt-4 border-t border-brand-border">
        {isGoogleOnly ? (
          <div className="p-4 bg-surface-containerLow rounded-md text-sm text-brand-slate">
            Tài khoản của bạn được liên kết thông qua Google và chưa cài đặt mật khẩu. Đăng nhập Google đã được bảo mật bởi Google, bạn không cần bật 2FA cho phương thức này.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-brand-slate">
              {settings.twoFactorEnabled 
                ? 'Mã xác thực sẽ được gửi tới email của bạn mỗi khi đăng nhập.'
                : 'Bật tính năng này để tăng cường bảo mật cho tài khoản.'}
            </div>
            <button
              onClick={() => onToggle(!settings.twoFactorEnabled)}
              className={`shrink-0 px-6 py-2 text-sm font-semibold rounded-md transition-colors ${
                settings.twoFactorEnabled
                  ? 'border-2 border-brand-border text-brand-slate hover:bg-surface-container'
                  : 'bg-brand-primary text-white hover:bg-brand-primaryDark'
              }`}
            >
              {settings.twoFactorEnabled ? 'Tắt 2FA' : 'Bật xác thực hai lớp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
