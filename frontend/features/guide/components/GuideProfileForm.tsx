'use client';

import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@/features/auth/types';
import { Button, FormField, Input } from '@/components/ui';
import type { UpdateProfileRequest } from '@/features/traveler-account/types';
import { validateImageFile } from '@/features/traveler-account/api/avatarUpload';

interface GuideProfileFormProps {
  user: UserProfile;
  onSave: (payload: UpdateProfileRequest, licenseFile: File | null) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}

/** `tags` are edited as one comma-separated line: the API takes a string array. */
const parseTags = (value: string) => value.split(',').map((tag) => tag.trim()).filter(Boolean);

const HTTP_URL = /^https?:\/\/\S+$/i;

const FIELD_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:cursor-not-allowed disabled:bg-slate-50';

type Errors = Partial<
  Record<'fullName' | 'phone' | 'experienceYears' | 'licenseNumber' | 'licenseImage' | 'languages' | 'specialties' | 'bio', string>
>;

export function GuideProfileForm({ user, onSave, onCancel, isSaving, error }: GuideProfileFormProps) {
  const guide = user.guideProfile;
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [bio, setBio] = useState(guide?.bio ?? '');
  const [languages, setLanguages] = useState((guide?.languages ?? []).join(', '));
  const [specialties, setSpecialties] = useState((guide?.specialties ?? []).join(', '));
  const [experienceYears, setExperienceYears] = useState(guide?.experienceYears?.toString() ?? '');
  const [licenseNumber, setLicenseNumber] = useState(guide?.licenseNumber ?? '');
  const [licenseImageUrl, setLicenseImageUrl] = useState(guide?.licenseImageUrl ?? '');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const busy = isSaving || isSubmitting;
  // The queued file wins; otherwise the link box previews only once it is a usable absolute URL,
  // so a half-typed link never fires a request for a relative path.
  const previewUrl = licensePreview ?? (HTTP_URL.test(licenseImageUrl.trim()) ? licenseImageUrl.trim() : '');

  useEffect(() => {
    return () => {
      if (licensePreview) URL.revokeObjectURL(licensePreview);
    };
  }, [licensePreview]);

  const clear = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const selectLicenseImage = (file?: File) => {
    if (!file) return;
    const message = validateImageFile(file, 'Ảnh giấy phép');
    if (message) {
      setErrors((current) => ({ ...current, licenseImage: message }));
      return;
    }
    setLicenseFile(file);
    setLicenseImageUrl('');
    setLicensePreview(URL.createObjectURL(file));
    clear('licenseImage');
  };

  const clearLicenseImage = () => {
    setLicenseFile(null);
    setLicensePreview(null);
    setLicenseImageUrl('');
    clear('licenseImage');
  };

  const validate = () => {
    const next: Errors = {};
    const name = fullName.trim();
    const tel = phone.trim();
    const languageList = parseTags(languages);
    const specialtyList = parseTags(specialties);
    const years = experienceYears.trim();

    if (name.length < 2 || name.length > 120) next.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
    if (tel && !/^\+?[0-9 ().-]{6,20}$/.test(tel)) next.phone = 'Số điện thoại không hợp lệ.';
    if (bio.trim().length > 5000) next.bio = 'Giới thiệu tối đa 5000 ký tự.';
    if (languageList.length > 20) next.languages = 'Tối đa 20 ngôn ngữ.';
    else if (languageList.some((tag) => tag.length < 2 || tag.length > 40)) next.languages = 'Mỗi ngôn ngữ từ 2 đến 40 ký tự.';
    if (specialtyList.length > 30) next.specialties = 'Tối đa 30 chuyên môn.';
    else if (specialtyList.some((tag) => tag.length < 2 || tag.length > 60)) next.specialties = 'Mỗi chuyên môn từ 2 đến 60 ký tự.';
    if (years && (!/^\d+$/.test(years) || Number(years) > 80)) next.experienceYears = 'Số năm kinh nghiệm từ 0 đến 80.';
    if (licenseNumber.trim() && (licenseNumber.trim().length < 3 || licenseNumber.trim().length > 100)) {
      next.licenseNumber = 'Số giấy phép từ 3 đến 100 ký tự.';
    }
    // The API can only replace this field, never clear it (an empty value fails its own min-length rule).
    if (!licenseNumber.trim() && guide?.licenseNumber) next.licenseNumber = 'Không thể xóa số giấy phép đã đăng ký.';
    // A chosen file wins over the link box, so only the link is validated when no file is queued.
    if (!licenseFile && licenseImageUrl.trim() && !HTTP_URL.test(licenseImageUrl.trim())) {
      next.licenseImage = 'Link ảnh phải bắt đầu bằng http:// hoặc https://.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const name = fullName.trim();
    const tel = phone.trim();
    const payload: UpdateProfileRequest = {};
    const guideProfile: NonNullable<UpdateProfileRequest['guideProfile']> = {};

    if (name !== user.fullName) payload.fullName = name;
    if (tel !== (user.phone ?? '')) payload.phone = tel || null;
    if (bio.trim() !== (guide?.bio ?? '')) guideProfile.bio = bio.trim();
    if (languages !== (guide?.languages ?? []).join(', ')) guideProfile.languages = parseTags(languages);
    if (specialties !== (guide?.specialties ?? []).join(', ')) guideProfile.specialties = parseTags(specialties);
    if (experienceYears.trim() !== (guide?.experienceYears?.toString() ?? '')) {
      guideProfile.experienceYears = experienceYears.trim() ? Number(experienceYears) : 0;
    }
    if (licenseNumber.trim() !== (guide?.licenseNumber ?? '')) guideProfile.licenseNumber = licenseNumber.trim();
    if (!licenseFile && licenseImageUrl.trim() !== (guide?.licenseImageUrl ?? '')) {
      guideProfile.licenseImageUrl = licenseImageUrl.trim() || null;
    }
    if (Object.keys(guideProfile).length > 0) payload.guideProfile = guideProfile;

    if (Object.keys(payload).length === 0 && !licenseFile) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(payload, licenseFile);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">Hồ sơ Hướng dẫn viên</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Chỉnh sửa thông tin</h2>
        <p className="mt-1 text-sm text-slate-500">Chỉ các trường bên dưới có thể được thay đổi.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Họ và tên" htmlFor="guide-full-name" required error={errors.fullName}>
          <Input
            id="guide-full-name"
            type="text"
            autoComplete="name"
            maxLength={120}
            value={fullName}
            disabled={busy}
            invalid={Boolean(errors.fullName)}
            onChange={(event) => {
              setFullName(event.target.value);
              clear('fullName');
            }}
          />
        </FormField>

        <FormField label="Số điện thoại" htmlFor="guide-phone" hint="Có thể dùng mã quốc gia, ví dụ +84 901 234 567." error={errors.phone}>
          <Input
            id="guide-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={phone}
            disabled={busy}
            invalid={Boolean(errors.phone)}
            onChange={(event) => {
              setPhone(event.target.value);
              clear('phone');
            }}
          />
        </FormField>

        <FormField label="Email" htmlFor="guide-email" hint="Email không thể thay đổi tại trang này.">
          <Input id="guide-email" type="email" value={user.email} disabled readOnly />
        </FormField>

        <FormField label="Số năm kinh nghiệm" htmlFor="guide-experience" error={errors.experienceYears}>
          <Input
            id="guide-experience"
            type="number"
            min={0}
            max={80}
            inputMode="numeric"
            value={experienceYears}
            disabled={busy}
            invalid={Boolean(errors.experienceYears)}
            onChange={(event) => {
              setExperienceYears(event.target.value);
              clear('experienceYears');
            }}
          />
        </FormField>

        <FormField label="Số giấy phép hành nghề" htmlFor="guide-license" error={errors.licenseNumber}>
          <Input
            id="guide-license"
            type="text"
            maxLength={100}
            value={licenseNumber}
            disabled={busy}
            invalid={Boolean(errors.licenseNumber)}
            onChange={(event) => {
              setLicenseNumber(event.target.value);
              clear('licenseNumber');
            }}
          />
        </FormField>

        <FormField
          label="Ảnh giấy phép hành nghề"
          htmlFor="guide-license-image-file"
          className="sm:col-span-2"
          hint="Tải ảnh lên (JPG, PNG hoặc WebP, tối đa 5 MB) hoặc dán link ảnh có sẵn."
          error={errors.licenseImage}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            {previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="mb-4 block w-fit">
                {/* Guides paste arbitrary HTTPS hosts, so next/image cannot preconfigure every domain. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Ảnh giấy phép hành nghề"
                  className="h-32 w-auto rounded-xl border border-slate-200 bg-white object-contain"
                />
              </a>
            ) : (
              <p className="mb-4 text-sm text-slate-500">Chưa có ảnh giấy phép.</p>
            )}

            <input
              ref={licenseInputRef}
              id="guide-license-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                selectLicenseImage(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={() => licenseInputRef.current?.click()}>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
                {previewUrl ? 'Chọn ảnh khác' : 'Chọn ảnh'}
              </Button>
              {previewUrl && (
                <Button type="button" variant="ghost" disabled={busy} onClick={clearLicenseImage}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                  Gỡ ảnh
                </Button>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="guide-license-image-url" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Hoặc dán link ảnh
              </label>
              <Input
                id="guide-license-image-url"
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://..."
                className="mt-2"
                value={licenseImageUrl}
                disabled={busy || Boolean(licenseFile)}
                invalid={Boolean(errors.licenseImage)}
                onChange={(event) => {
                  setLicenseImageUrl(event.target.value);
                  clear('licenseImage');
                }}
              />
              {licenseFile && <p className="mt-2 text-xs text-slate-500">Ảnh đã chọn sẽ được tải lên khi bạn lưu; link bên trên sẽ bị bỏ qua.</p>}
            </div>
          </div>
        </FormField>

        <FormField label="Ngôn ngữ" htmlFor="guide-languages" hint="Phân tách bằng dấu phẩy, ví dụ: Tiếng Việt, English." error={errors.languages}>
          <Input
            id="guide-languages"
            type="text"
            value={languages}
            disabled={busy}
            invalid={Boolean(errors.languages)}
            onChange={(event) => {
              setLanguages(event.target.value);
              clear('languages');
            }}
          />
        </FormField>

        <FormField
          label="Chuyên môn"
          htmlFor="guide-specialties"
          className="sm:col-span-2"
          hint="Phân tách bằng dấu phẩy, ví dụ: Trekking, Văn hóa bản địa."
          error={errors.specialties}
        >
          <Input
            id="guide-specialties"
            type="text"
            value={specialties}
            disabled={busy}
            invalid={Boolean(errors.specialties)}
            onChange={(event) => {
              setSpecialties(event.target.value);
              clear('specialties');
            }}
          />
        </FormField>

        <FormField label="Giới thiệu" htmlFor="guide-bio" className="sm:col-span-2" error={errors.bio}>
          <textarea
            id="guide-bio"
            rows={4}
            maxLength={5000}
            value={bio}
            disabled={busy}
            aria-invalid={Boolean(errors.bio) || undefined}
            placeholder="Chia sẻ kinh nghiệm dẫn tour và phong cách của bạn..."
            className={`${FIELD_CLASS} resize-y`}
            onChange={(event) => {
              setBio(event.target.value);
              clear('bio');
            }}
          />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} className="sm:min-w-24">
          Hủy
        </Button>
        <Button type="submit" loading={busy} loadingLabel="Đang lưu..." className="sm:min-w-36">
          Lưu thay đổi
        </Button>
      </div>
    </form>
  );
}
