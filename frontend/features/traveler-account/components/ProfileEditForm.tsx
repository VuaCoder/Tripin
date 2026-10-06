'use client';

import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@/features/auth/types';
import { Button, FormField, Input } from '@/components/ui';
import type { AvatarChange, UpdateProfileRequest } from '../types';
import { validateAvatarFile } from '../api/avatarUpload';
import { AvatarPreview } from './AvatarPreview';

interface ProfileEditFormProps {
  user: UserProfile;
  onSave: (data: UpdateProfileRequest, avatarChange: AvatarChange) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}

export function ProfileEditForm({ user, onSave, onCancel, isSaving, error }: ProfileEditFormProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || '');
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<'fullName' | 'phone' | 'avatar', string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = isSaving || isSubmitting;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validate = () => {
    const errs: Partial<Record<'fullName' | 'phone' | 'avatar', string>> = {};
    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      errs.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
    }
    if (normalizedPhone && !/^\+?[0-9 ().-]{6,20}$/.test(normalizedPhone)) {
      errs.phone = 'Số điện thoại không hợp lệ.';
    }
    if (selectedAvatar) {
      const avatarError = validateAvatarFile(selectedAvatar);
      if (avatarError) errs.avatar = avatarError;
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const selectAvatar = (file?: File) => {
    if (!file) return;
    const errorMessage = validateAvatarFile(file);
    if (errorMessage) {
      setValidationErrors((current) => ({ ...current, avatar: errorMessage }));
      return;
    }
    setSelectedAvatar(file);
    setRemoveAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
    setValidationErrors((current) => ({ ...current, avatar: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const normalizedName = fullName.trim();
    const normalizedPhone = phone.trim();
    const payload: UpdateProfileRequest = {};
    if (normalizedName !== user.fullName) payload.fullName = normalizedName;
    if (normalizedPhone !== (user.phone || '')) payload.phone = normalizedPhone || null;
    const avatarChange: AvatarChange = selectedAvatar
      ? { kind: 'upload', file: selectedAvatar }
      : removeAvatar && user.avatarUrl
        ? { kind: 'remove' }
        : { kind: 'unchanged' };

    setIsSubmitting(true);
    try {
      await onSave(payload, avatarChange);
    } finally {
      setIsSubmitting(false);
    }
  };

  const avatarUrl = removeAvatar ? undefined : previewUrl || user.avatarUrl;
  const avatarChanged = Boolean(selectedAvatar) || (removeAvatar && Boolean(user.avatarUrl));
  const hasChanges = fullName.trim() !== user.fullName || phone.trim() !== (user.phone || '') || avatarChanged;

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

      <FormField
        label="Ảnh đại diện"
        htmlFor="traveler-avatar-file"
        hint="Chấp nhận JPG, PNG hoặc WebP, tối đa 5 MB. Ảnh chỉ được tải lên khi bạn lưu thay đổi."
        error={validationErrors.avatar}
      >
        <div className="flex flex-col gap-5 rounded-2xl border border-surface-container bg-surface-container-low/55 p-5 sm:flex-row sm:items-center sm:p-6">
          <AvatarPreview url={avatarUrl} name={fullName} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-on-surface">{selectedAvatar ? selectedAvatar.name : 'Chọn ảnh từ thiết bị của bạn'}</p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              {selectedAvatar ? `${Math.ceil(selectedAvatar.size / 1024)} KB · Sẽ tải lên khi lưu hồ sơ.` : 'Ảnh rõ mặt, nền đơn giản sẽ hiển thị tốt nhất.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                id="traveler-avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  selectAvatar(event.target.files?.[0]);
                  event.target.value = '';
                }}
                aria-describedby={validationErrors.avatar ? 'traveler-avatar-file-error' : 'traveler-avatar-file-hint'}
              />
              <Button type="button" variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
                {selectedAvatar || user.avatarUrl ? 'Chọn ảnh khác' : 'Chọn ảnh'}
              </Button>
              {(avatarUrl || selectedAvatar) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setSelectedAvatar(null);
                    setPreviewUrl(null);
                    setRemoveAvatar(true);
                    setValidationErrors((current) => ({ ...current, avatar: undefined }));
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                  Gỡ ảnh
                </Button>
              )}
            </div>
          </div>
        </div>
      </FormField>

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
            disabled={busy}
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
            disabled={busy}
            invalid={Boolean(validationErrors.phone)}
            aria-describedby={validationErrors.phone ? 'traveler-phone-error' : 'traveler-phone-hint'}
            maxLength={20}
          />
        </FormField>

        <FormField label="Email" htmlFor="traveler-email" hint="Email không thể thay đổi tại trang này.">
          <Input id="traveler-email" type="email" value={user.email} disabled readOnly />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-surface-container pt-6 sm:flex-row sm:justify-end">
        <Button type="button" onClick={onCancel} disabled={busy} variant="ghost" className="sm:min-w-24">
          Hủy
        </Button>
        <Button type="submit" disabled={!hasChanges} loading={busy} loadingLabel="Đang lưu..." className="sm:min-w-36">
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
