'use client';
import { useState } from 'react';
import type { UserProfile } from '@/features/auth/types';
import { Button, FormField, Input } from '@/components/ui';
import type { UpdateProfileRequest } from '../types';
import { AvatarPreview } from './AvatarPreview';

interface ProfileEditFormProps {
  user: UserProfile;
  onSave: (data: UpdateProfileRequest) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}

export function ProfileEditForm({ user, onSave, onCancel, isSaving, error }: ProfileEditFormProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [validationErrors, setValidationErrors] = useState<Partial<Record<'fullName' | 'phone' | 'avatarUrl', string>>>({});

  const validate = () => {
    const errs: Partial<Record<'fullName' | 'phone' | 'avatarUrl', string>> = {};
    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedAvatar = avatarUrl.trim();

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      errs.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
    }
    if (normalizedPhone && !/^\+?[0-9 ().-]{6,20}$/.test(normalizedPhone)) {
      errs.phone = 'Số điện thoại không hợp lệ.';
    }
    if (normalizedAvatar) {
      try {
        const parsedUrl = new URL(normalizedAvatar);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('unsupported protocol');
      } catch {
        errs.avatarUrl = 'Nhập URL hợp lệ bắt đầu bằng http:// hoặc https://.';
      }
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedAvatar = avatarUrl.trim();
    const payload: UpdateProfileRequest = {};
    if (normalizedName !== user.fullName) payload.fullName = normalizedName;
    const currentPhone = user.phone || '';
    if (normalizedPhone !== currentPhone) payload.phone = normalizedPhone || null;
    const currentAvatar = user.avatarUrl || '';
    if (normalizedAvatar !== currentAvatar) payload.avatarUrl = normalizedAvatar || null;

    void onSave(payload);
  };

  const hasChanges = fullName.trim() !== user.fullName || phone.trim() !== (user.phone || '') || avatarUrl.trim() !== (user.avatarUrl || '');

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Hồ sơ Traveler</p>
        <h2 className="mt-1 text-headline-md font-bold text-on-surface">Chỉnh sửa thông tin</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Chỉ các trường bên dưới có thể được thay đổi.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-error/20 bg-error-container p-4 text-sm font-medium text-on-error-container" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-2xl border border-surface-container bg-surface-container-low/55 p-5 sm:flex-row sm:items-center sm:p-6">
        <AvatarPreview url={avatarUrl.trim()} name={fullName} />
        <div>
          <p className="font-bold text-on-surface">Xem trước ảnh đại diện</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-on-surface-variant">
            Dùng liên kết ảnh công khai qua HTTP hoặc HTTPS. Để trống để quay về ảnh chữ cái mặc định.
          </p>
        </div>
      </div>

      <div className="grid max-w-2xl gap-5">
        <FormField label="Họ và tên" htmlFor="traveler-full-name" required error={validationErrors.fullName}>
          <Input
            id="traveler-full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setValidationErrors((current) => ({ ...current, fullName: undefined }));
            }}
            disabled={isSaving}
            invalid={Boolean(validationErrors.fullName)}
            aria-describedby={validationErrors.fullName ? 'traveler-full-name-error' : undefined}
            maxLength={120}
          />
        </FormField>

        <FormField
          label="Số điện thoại"
          htmlFor="traveler-phone"
          hint="Có thể dùng mã quốc gia, ví dụ +84 901 234 567."
          error={validationErrors.phone}
        >
          <Input
            id="traveler-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setValidationErrors((current) => ({ ...current, phone: undefined }));
            }}
            disabled={isSaving}
            invalid={Boolean(validationErrors.phone)}
            aria-describedby={validationErrors.phone ? 'traveler-phone-error' : 'traveler-phone-hint'}
            maxLength={20}
          />
        </FormField>

        <FormField
          label="URL ảnh đại diện"
          htmlFor="traveler-avatar-url"
          hint="Chỉ chấp nhận liên kết bắt đầu bằng http:// hoặc https://."
          error={validationErrors.avatarUrl}
        >
          <Input
            id="traveler-avatar-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/avatar.jpg"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value);
              setValidationErrors((current) => ({ ...current, avatarUrl: undefined }));
            }}
            disabled={isSaving}
            invalid={Boolean(validationErrors.avatarUrl)}
            aria-describedby={validationErrors.avatarUrl ? 'traveler-avatar-url-error' : 'traveler-avatar-url-hint'}
            maxLength={500}
          />
        </FormField>

        <FormField label="Email" htmlFor="traveler-email" hint="Email không thể thay đổi tại trang này.">
          <Input id="traveler-email" type="email" value={user.email} disabled readOnly />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-surface-container pt-6 sm:flex-row sm:justify-end">
        <Button type="button" onClick={onCancel} disabled={isSaving} variant="ghost" className="sm:min-w-24">
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={!hasChanges}
          loading={isSaving}
          loadingLabel="Đang lưu..."
          className="sm:min-w-36"
        >
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
