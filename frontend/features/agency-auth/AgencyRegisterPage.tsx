'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
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
  address: string;
  description: string;
  website: string;
}

type FieldErrors = Partial<Record<keyof RegisterValues, string>>;

const INITIAL_VALUES: RegisterValues = {
  fullName: '', email: '', phone: '', password: '', confirmPassword: '',
  companyName: '', licenseNumber: '', address: '', description: '', website: '',
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

export function AgencyRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const key = event.target.name as keyof RegisterValues;
    setValues((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError('');
  };

  const continueToProfile = () => {
    const nextErrors = validateAccount(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = { ...validateAccount(values), ...validateBusiness(values) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (Object.keys(validateAccount(values)).length > 0) setStep(1);
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
        address: values.address.trim(),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.website.trim() ? { website: values.website.trim() } : {}),
      });
      router.push(`/agency/verify-otp?email=${encodeURIComponent(result.email)}&purpose=REGISTER&expires=${result.otpExpiresInSeconds}`);
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

  return (
    <AgencyAuthShell
      eyebrow="Đăng ký Agency"
      title={step === 1 ? 'Tạo tài khoản đối tác' : 'Hoàn thiện hồ sơ doanh nghiệp'}
      description={step === 1 ? 'Dùng email doanh nghiệp để tạo tài khoản Agency riêng biệt.' : 'Thông tin này được gửi xét duyệt sau khi bạn xác thực email.'}
      backHref="/"
      onBack={step === 2 ? () => setStep(1) : undefined}
      wide
    >
      <div className="mb-7 flex items-center gap-3" aria-label={`Bước ${step} trên 2`}>
        {[1, 2].map((item) => (
          <div key={item} className="flex flex-1 items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${item <= step ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-400'}`}>{item}</span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-bold ${item <= step ? 'text-brand-teal' : 'text-slate-400'}`}>{item === 1 ? 'Tài khoản' : 'Doanh nghiệp'}</p>
              <div className={`mt-1 h-1 rounded-full ${item <= step ? 'bg-brand-teal' : 'bg-slate-100'}`} />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} noValidate>
        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label="Họ và tên người đại diện" name="fullName" value={values.fullName} onChange={update} error={errors.fullName} autoComplete="name" placeholder="Nguyễn Minh Anh" required /></div>
            <div className="sm:col-span-2"><FormField label="Email doanh nghiệp" name="email" value={values.email} onChange={update} error={errors.email} type="email" autoComplete="email" placeholder="partner@agency.vn" required /></div>
            <div className="sm:col-span-2"><FormField label="Số điện thoại" name="phone" value={values.phone} onChange={update} error={errors.phone} type="tel" autoComplete="tel" placeholder="+84 912 345 678" hint="Bắt buộc để liên hệ, chưa cần xác thực ở bước này." required /></div>
            <FormField label="Mật khẩu" name="password" value={values.password} onChange={update} error={errors.password} type="password" autoComplete="new-password" placeholder="Ít nhất 8 ký tự" required />
            <FormField label="Nhập lại mật khẩu" name="confirmPassword" value={values.confirmPassword} onChange={update} error={errors.confirmPassword} type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" required />
            <button type="button" onClick={continueToProfile} className="mt-2 h-12 rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark focus:outline-none focus:ring-4 focus:ring-cyan-100 sm:col-span-2">
              Tiếp tục hoàn thiện hồ sơ <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><FormField label="Tên doanh nghiệp / thương hiệu" name="companyName" value={values.companyName} onChange={update} error={errors.companyName} autoComplete="organization" placeholder="Tripri Travel Co., Ltd" required /></div>
            <FormField label="Mã giấy phép kinh doanh" name="licenseNumber" value={values.licenseNumber} onChange={update} error={errors.licenseNumber} placeholder="GPKD-0123456789" required />
            <FormField label="Website" name="website" value={values.website} onChange={update} error={errors.website} type="url" autoComplete="url" placeholder="https://agency.vn" />
            <div className="sm:col-span-2"><FormField label="Địa chỉ trụ sở" name="address" value={values.address} onChange={update} error={errors.address} autoComplete="street-address" placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" required /></div>
            <div className="sm:col-span-2"><FormField label="Giới thiệu doanh nghiệp" name="description" value={values.description} onChange={update} error={errors.description} placeholder="Lĩnh vực hoạt động, thị trường và thế mạnh của Agency..." multiline hint="Không bắt buộc, tối đa 5.000 ký tự." /></div>

            {submitError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">{submitError}</div>}
            <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row">
              <button type="button" onClick={() => setStep(1)} disabled={submitting} className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Quay lại</button>
              <button type="submit" disabled={submitting} className="h-12 flex-[1.5] rounded-xl bg-brand-teal px-5 text-sm font-bold text-white shadow-lg shadow-cyan-900/15 transition hover:bg-brand-tealDark disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản & gửi OTP'}
              </button>
            </div>
          </div>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">Đã có tài khoản Agency? <Link href="/agency/login" className="font-bold text-brand-teal hover:underline">Đăng nhập tại đây</Link></p>
    </AgencyAuthShell>
  );
}
