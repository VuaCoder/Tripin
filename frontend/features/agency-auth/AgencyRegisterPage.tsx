'use client';

import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgencyApiError, agencyAuthApi } from './api';
import { AgencyAuthShell } from './AgencyAuthShell';
import { FormField } from './FormField';

interface RegisterValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  licenseNumber: string;
  taxId: string;
  businessLicenseUrl: string;
  address: string;
  description: string;
  website: string;
}

type FieldErrors = Partial<Record<keyof RegisterValues, string>>;

const INITIAL_VALUES: RegisterValues = {
  fullName: '', email: '', phone: '', password: '', confirmPassword: '',
  companyName: '', licenseNumber: '', taxId: '', businessLicenseUrl: '',
  address: '', description: '', website: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,20}$/;

function validateAccount(values: RegisterValues): FieldErrors {
  const errors: FieldErrors = {};
  const fullName = values.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = 'Họ tên cần từ 2 đến 120 ký tự.';
  if (!EMAIL_PATTERN.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Email chưa đúng định dạng.';
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = 'Số điện thoại cần từ 6–20 ký tự số và có thể bắt đầu bằng +.';
  if (values.password.length < 8 || values.password.length > 72 || !/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = 'Mật khẩu cần 8–72 ký tự, gồm ít nhất 1 chữ và 1 số.';
  }
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
  return errors;
}

function validateBusiness(values: RegisterValues): FieldErrors {
  const errors: FieldErrors = {};
  const companyName = values.companyName.trim();
  const licenseNumber = values.licenseNumber.trim();
  const address = values.address.trim();
  if (companyName.length < 2 || companyName.length > 200) errors.companyName = 'Tên doanh nghiệp cần từ 2 đến 200 ký tự.';
  if (licenseNumber.length < 3 || licenseNumber.length > 100) errors.licenseNumber = 'Mã giấy phép cần từ 3 đến 100 ký tự.';
  if (address.length < 5 || address.length > 500) errors.address = 'Địa chỉ cần từ 5 đến 500 ký tự.';
  if (values.description.trim().length > 5000) errors.description = 'Mô tả không được vượt quá 5.000 ký tự.';
  const website = values.website.trim();
  if (website) {
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol) || website.length > 300) throw new Error();
    } catch {
      errors.website = 'Website cần là URL đầy đủ, ví dụ https://agency.vn.';
    }
  }
  return errors;
}

function validateLegal(values: RegisterValues): FieldErrors {
  const errors: FieldErrors = {};
  const taxId = values.taxId.trim();
  if (!taxId) {
    errors.taxId = 'Vui lòng cung cấp mã số thuế doanh nghiệp.';
  } else if (!/^[0-9]{10}(-[0-9]{3})?$/.test(taxId) && !/^[0-9]{13}$/.test(taxId)) {
    errors.taxId = 'Mã số thuế gồm 10 số (doanh nghiệp) hoặc 13 số (chi nhánh).';
  }
  if (!values.businessLicenseUrl) {
    errors.businessLicenseUrl = 'Vui lòng tải lên ảnh chụp giấy phép kinh doanh (Cloudinary).';
  }
  return errors;
}

export function AgencyRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const key = event.target.name as keyof RegisterValues;
    setValues((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError('');
  };

  const continueToStep2 = () => {
    const nextErrors = validateAccount(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const continueToStep3 = () => {
    const nextErrors = validateBusiness(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((current) => ({ ...current, businessLicenseUrl: 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, businessLicenseUrl: 'Dung lượng ảnh tối đa 5 MB.' }));
      return;
    }

    setUploadingImage(true);
    setErrors((current) => ({ ...current, businessLicenseUrl: undefined }));
    try {
      const result = await agencyAuthApi.uploadLicenseImage(file);
      setValues((current) => ({ ...current, businessLicenseUrl: result.url }));
    } catch (err) {
      setErrors((current) => ({
        ...current,
        businessLicenseUrl: err instanceof Error ? err.message : 'Không thể tải ảnh lên. Vui lòng thử lại.',
      }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = { ...validateAccount(values), ...validateBusiness(values), ...validateLegal(values) };
    setErrors(nextErrors);

    if (Object.keys(validateAccount(values)).length > 0) {
      setStep(1);
      return;
    }
    if (Object.keys(validateBusiness(values)).length > 0) {
      setStep(2);
      return;
    }
    if (Object.keys(validateLegal(values)).length > 0) {
      setStep(3);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await agencyAuthApi.register({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
        companyName: values.companyName.trim(),
        licenseNumber: values.licenseNumber.trim(),
        taxId: values.taxId.trim(),
        businessLicenseUrl: values.businessLicenseUrl,
        address: values.address.trim(),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.website.trim() ? { website: values.website.trim() } : {}),
      });

      // Điều hướng về trang login kèm thông báo thành công
      router.push(`/agency/login?registered=true&email=${encodeURIComponent(result.email)}`);
    } catch (error) {
      if (error instanceof AgencyApiError && error.code === 'EMAIL_ALREADY_REGISTERED') {
        setErrors((current) => ({ ...current, email: 'Email này đã được sử dụng.' }));
        setStep(1);
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Đăng ký chưa thành công. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = {
    1: 'Tạo tài khoản đại diện',
    2: 'Hồ sơ doanh nghiệp',
    3: 'Mã số thuế & Giấy phép KD',
  };

  const stepDescriptions = {
    1: 'Dùng email doanh nghiệp để tạo tài khoản Agency đại diện pháp nhân.',
    2: 'Cung cấp tên thương hiệu, địa chỉ trụ sở và thông tin hoạt động.',
    3: 'Tải ảnh chụp giấy phép kinh doanh và mã số thuế để ban quản trị đối soát.',
  };

  return (
    <AgencyAuthShell
      eyebrow="Đăng ký Đối tác Lữ hành"
      title={stepTitles[step]}
      description={stepDescriptions[step]}
      backHref="/"
      onBack={step === 2 ? () => setStep(1) : step === 3 ? () => setStep(2) : undefined}
      wide
    >
      {/* 3-Step Stepper */}
      <div className="mb-7 flex items-center gap-3" aria-label={`Bước ${step} trên 3`}>
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                item <= step ? 'bg-brand-teal text-white shadow-sm' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {item}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-bold ${item <= step ? 'text-brand-teal' : 'text-slate-400'}`}>
                {item === 1 ? 'Tài khoản' : item === 2 ? 'Doanh nghiệp' : 'Giấy phép & MST'}
              </p>
              <div className={`mt-1 h-1 rounded-full ${item <= step ? 'bg-brand-teal' : 'bg-slate-100'}`} />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} noValidate>
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Họ và tên người đại diện"
                name="fullName"
                value={values.fullName}
                onChange={update}
                error={errors.fullName}
                autoComplete="name"
                placeholder="Nguyễn Minh Anh"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Email doanh nghiệp"
                name="email"
                value={values.email}
                onChange={update}
                error={errors.email}
                type="email"
                autoComplete="email"
                placeholder="partner@agency.vn"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Số điện thoại"
                name="phone"
                value={values.phone}
                onChange={update}
                error={errors.phone}
                type="tel"
                autoComplete="tel"
                placeholder="+84 912 345 678"
                hint="Số liên hệ chính thức của người đại diện."
                required
              />
            </div>
            <FormField
              label="Mật khẩu"
              name="password"
              value={values.password}
              onChange={update}
              error={errors.password}
              type="password"
              autoComplete="new-password"
              placeholder="Ít nhất 8 ký tự"
              required
            />
            <FormField
              label="Nhập lại mật khẩu"
              name="confirmPassword"
              value={values.confirmPassword}
              onChange={update}
              error={errors.confirmPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              required
            />
            <button
              type="button"
              onClick={continueToStep2}
              className="mt-2 h-12 rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark focus:outline-none focus:ring-4 focus:ring-cyan-100 sm:col-span-2"
            >
              Tiếp tục: Thông tin doanh nghiệp <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Tên doanh nghiệp / thương hiệu"
                name="companyName"
                value={values.companyName}
                onChange={update}
                error={errors.companyName}
                autoComplete="organization"
                placeholder="Công ty TNHH Du lịch & Lữ hành Á Châu"
                required
              />
            </div>
            <FormField
              label="Mã giấy phép kinh doanh lữ hành"
              name="licenseNumber"
              value={values.licenseNumber}
              onChange={update}
              error={errors.licenseNumber}
              placeholder="GPKD-0123456789"
              required
            />
            <FormField
              label="Website chính thức"
              name="website"
              value={values.website}
              onChange={update}
              error={errors.website}
              type="url"
              autoComplete="url"
              placeholder="https://agency.vn"
            />
            <div className="sm:col-span-2">
              <FormField
                label="Địa chỉ trụ sở doanh nghiệp"
                name="address"
                value={values.address}
                onChange={update}
                error={errors.address}
                autoComplete="street-address"
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Giới thiệu doanh nghiệp"
                name="description"
                value={values.description}
                onChange={update}
                error={errors.description}
                placeholder="Lĩnh vực hoạt động, các tuyến tour thế mạnh..."
                multiline
                hint="Không bắt buộc, tối đa 5.000 ký tự."
              />
            </div>

            <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Quay lại bước 1
              </button>
              <button
                type="button"
                onClick={continueToStep3}
                className="h-12 flex-[1.5] rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark"
              >
                Tiếp tục: Pháp lý & Giấy phép <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <FormField
              label="Mã số thuế doanh nghiệp (MST)"
              name="taxId"
              value={values.taxId}
              onChange={update}
              error={errors.taxId}
              placeholder="0101234567 hoặc 0101234567-001"
              hint="MST gồm 10 số (doanh nghiệp) hoặc 13 số (chi nhánh)."
              required
            />

            {/* Document upload box */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Ảnh chụp giấy phép kinh doanh lữ hành <span className="text-red-500">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />

              {values.businessLicenseUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-2xl border-2 border-dashed p-4 transition-all ${
                    isDragging
                      ? 'border-brand-teal bg-teal-50/80 scale-[1.01] ring-4 ring-teal-100'
                      : 'border-teal-300 bg-teal-50/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={values.businessLicenseUrl}
                      alt="Giấy phép kinh doanh"
                      className="h-28 w-44 rounded-xl object-cover border border-teal-200 shadow-sm"
                    />
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm font-bold text-slate-800 mb-1">
                        Ảnh giấy phép kinh doanh đã tải lên
                      </p>
                      <p className="text-xs text-slate-500">
                        Bạn có thể chọn ảnh mới hoặc kéo thả ảnh khác vào đây để thay thế.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">upload</span>
                          <span>{uploadingImage ? 'Đang tải...' : 'Thay đổi ảnh'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                    isDragging
                      ? 'border-brand-teal bg-teal-50/80 scale-[1.01] ring-4 ring-teal-100'
                      : errors.businessLicenseUrl
                      ? 'border-red-300 bg-red-50/30 hover:bg-red-50/50'
                      : 'border-slate-300 bg-slate-50/60 hover:border-brand-teal hover:bg-teal-50/30'
                  }`}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-brand-teal">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {uploadingImage
                      ? 'Đang tải ảnh lên Cloudinary...'
                      : isDragging
                      ? 'Thả ảnh chụp giấy phép vào đây...'
                      : 'Kéo thả ảnh chụp giấy phép vào đây, hoặc bấm để chọn tệp'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Hỗ trợ định dạng JPG, PNG hoặc WebP (Dung lượng tối đa 5 MB)
                  </p>
                </div>
              )}

              {errors.businessLicenseUrl && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.businessLicenseUrl}</p>
              )}
            </div>

            {submitError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting || uploadingImage}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Quay lại bước 2
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingImage}
                className="h-12 flex-[1.5] rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Đang hoàn tất đăng ký...</span>
                  </>
                ) : (
                  <span>Hoàn tất đăng ký Agency</span>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Đã có tài khoản Agency?{' '}
        <Link href="/agency/login" className="font-bold text-brand-teal hover:underline">
          Đăng nhập tại đây
        </Link>
      </p>
    </AgencyAuthShell>
  );
}
