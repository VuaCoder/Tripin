'use client';
import { useState } from 'react';
import type { UserProfile } from '@/features/auth/types';
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim() || fullName.length < 2 || fullName.length > 120) {
      errs.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
    }
    if (phone.trim() && !/^\+?[0-9 ().-]{6,20}$/.test(phone)) {
      errs.phone = 'Số điện thoại không hợp lệ.';
    }
    if (avatarUrl.trim() && !avatarUrl.startsWith('http')) {
      errs.avatarUrl = 'URL ảnh đại diện phải bắt đầu bằng http:// hoặc https://';
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: UpdateProfileRequest = {};
    if (fullName !== user.fullName) payload.fullName = fullName;
    const currentPhone = user.phone || '';
    if (phone !== currentPhone) payload.phone = phone || null;
    const currentAvatar = user.avatarUrl || '';
    if (avatarUrl !== currentAvatar) payload.avatarUrl = avatarUrl || null;

    onSave(payload);
  };

  const hasChanges = fullName !== user.fullName || phone !== (user.phone || '') || avatarUrl !== (user.avatarUrl || '');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-headline-md text-brand-ink">Chỉnh sửa hồ sơ</h2>
      
      {error && (
        <div className="p-4 bg-[#FFDAD6] text-[#93000A] rounded-md text-sm border border-[#BA1A1A]/20">
          {error}
        </div>
      )}

      <div className="flex items-center gap-6 pb-6 border-b border-brand-border">
        <AvatarPreview url={avatarUrl} name={fullName} />
      </div>

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-semibold text-brand-ink mb-1">Họ và tên *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-md border border-brand-border focus:outline-none focus:border-brand-primary text-brand-ink"
          />
          {validationErrors.fullName && <div className="text-sm text-[#BA1A1A] mt-1">{validationErrors.fullName}</div>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-ink mb-1">Số điện thoại</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-md border border-brand-border focus:outline-none focus:border-brand-primary text-brand-ink"
          />
          {validationErrors.phone && <div className="text-sm text-[#BA1A1A] mt-1">{validationErrors.phone}</div>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-ink mb-1">URL Ảnh đại diện (HTTP/HTTPS)</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={isSaving}
            className="w-full px-4 py-2 rounded-md border border-brand-border focus:outline-none focus:border-brand-primary text-brand-ink"
          />
          {validationErrors.avatarUrl && <div className="text-sm text-[#BA1A1A] mt-1">{validationErrors.avatarUrl}</div>}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-semibold text-brand-slate hover:bg-surface-container rounded-md transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={!hasChanges || isSaving}
          className="px-6 py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-primaryDark rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}
