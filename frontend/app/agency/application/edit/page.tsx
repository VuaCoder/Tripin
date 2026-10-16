'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { agencyAuthApi, type AgencyApplicationDetailsDto } from '@/features/agency-auth';

function ApplicationEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || undefined;
  const email = searchParams.get('email') || undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form values
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [businessLicenseUrl, setBusinessLicenseUrl] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [verificationNote, setVerificationNote] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token && !email) {
        setLoading(false);
        setError('Không tìm thấy thông tin hồ sơ để chỉnh sửa.');
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data: AgencyApplicationDetailsDto = await agencyAuthApi.getApplicationDetails({ token, email });
        setFullName(data.fullName || '');
        setPhone(data.phone || '');
        setCompanyName(data.companyName || '');
        setLicenseNumber(data.licenseNumber || '');
        setTaxId(data.taxId || '');
        setBusinessLicenseUrl(data.businessLicenseUrl || '');
        setAddress(data.address || '');
        setDescription(data.description || '');
        setWebsite(data.website || '');
        setVerificationNote(data.verificationNote || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải chi tiết hồ sơ.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, email]);

  const processFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFieldErrors((curr) => ({ ...curr, businessLicenseUrl: 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((curr) => ({ ...curr, businessLicenseUrl: 'Dung lượng ảnh tối đa 5 MB.' }));
      return;
    }

    setUploadingImage(true);
    setFieldErrors((curr) => ({ ...curr, businessLicenseUrl: '' }));
    try {
      const result = await agencyAuthApi.uploadLicenseImage(file);
      setBusinessLicenseUrl(result.url);
    } catch (err) {
      setFieldErrors((curr) => ({
        ...curr,
        businessLicenseUrl: err instanceof Error ? err.message : 'Không thể tải ảnh lên. Vui lòng thử lại.',
      }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên người đại diện.';
    if (!phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại.';
    if (!companyName.trim()) errors.companyName = 'Vui lòng nhập tên doanh nghiệp.';
    if (!licenseNumber.trim()) errors.licenseNumber = 'Vui lòng nhập mã giấy phép kinh doanh.';
    if (!taxId.trim()) {
      errors.taxId = 'Vui lòng nhập mã số thuế.';
    } else if (!/^[0-9]{10}(-[0-9]{3})?$/.test(taxId.trim()) && !/^[0-9]{13}$/.test(taxId.trim())) {
      errors.taxId = 'Mã số thuế gồm 10 số (doanh nghiệp) hoặc 13 số (chi nhánh).';
    }
    if (!businessLicenseUrl) errors.businessLicenseUrl = 'Vui lòng tải lên ảnh chụp giấy phép kinh doanh.';
    if (!address.trim()) errors.address = 'Vui lòng nhập địa chỉ trụ sở.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await agencyAuthApi.updateApplication({
        token,
        email,
        fullName: fullName.trim(),
        phone: phone.trim(),
        companyName: companyName.trim(),
        licenseNumber: licenseNumber.trim(),
        taxId: taxId.trim(),
        businessLicenseUrl,
        address: address.trim(),
        description: description.trim() || undefined,
        website: website.trim() || undefined,
      });

      // Điều hướng về lại trang /application-status
      const query = token ? `token=${encodeURIComponent(token)}` : `email=${encodeURIComponent(res.status.email)}`;
      router.push(`/application-status?${query}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không thể gửi lại hồ sơ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-vietnam selection:bg-brand-teal selection:text-white flex items-center justify-center">
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-xl border border-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-brand-teal" />
              <p className="mt-4 text-xs font-bold text-slate-500">Đang tải dữ liệu hồ sơ...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm font-bold text-rose-600">{error}</p>
              <Link
                href="/agency/login"
                className="mt-4 inline-block text-xs font-bold text-brand-teal underline"
              >
                Quay lại đăng nhập Agency
              </Link>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Chỉnh sửa và Gửi lại Hồ sơ</h1>
              <p className="mt-1 text-xs text-slate-500">
                Cập nhật lại các thông tin chưa chính xác hoặc bổ sung tài liệu để ban quản trị thẩm định lại.
              </p>

              {/* Rejection Note Display */}
              {verificationNote && (
                <div className="mt-5 rounded-2xl bg-rose-50 border border-rose-200 p-4">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-base">info</span>
                    <span>Lý do từ chối cần khắc phục:</span>
                  </div>
                  <p className="text-xs text-rose-900 font-medium leading-relaxed">{verificationNote}</p>
                </div>
              )}

              <form onSubmit={handlePreSubmit} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Họ và tên người đại diện *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.fullName && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.fullName}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Số điện thoại *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.phone && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Tên doanh nghiệp / thương hiệu *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.companyName && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.companyName}</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Mã giấy phép kinh doanh *</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.licenseNumber && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.licenseNumber}</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Mã số thuế doanh nghiệp (MST) *</label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="0101234567"
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.taxId && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.taxId}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Website chính thức</label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://agency.vn"
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Địa chỉ trụ sở *</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                    {fieldErrors.address && <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.address}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">Giới thiệu tóm tắt</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-brand-teal"
                    />
                  </div>
                </div>

                {/* Upload Section with Drag & Drop */}
                <div className="pt-2">
                  <label className="mb-2 block text-xs font-bold text-slate-700">
                    Ảnh chụp giấy phép kinh doanh lữ hành *
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {businessLicenseUrl ? (
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
                          src={businessLicenseUrl}
                          alt="Giấy phép kinh doanh"
                          className="h-28 w-44 rounded-xl object-cover border border-teal-200 shadow-sm"
                        />
                        <div className="flex-1 text-center sm:text-left">
                          <p className="text-xs font-bold text-slate-800 mb-1">
                            Ảnh giấy phép kinh doanh đã tải lên
                          </p>
                          <p className="text-[11px] text-slate-500">
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
                      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                        isDragging
                          ? 'border-brand-teal bg-teal-50/80 scale-[1.01] ring-4 ring-teal-100'
                          : 'border-slate-300 hover:border-brand-teal hover:bg-teal-50/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl text-brand-teal">cloud_upload</span>
                      <p className="mt-2 text-xs font-bold text-slate-800">
                        {uploadingImage
                          ? 'Đang tải ảnh...'
                          : isDragging
                          ? 'Thả ảnh chụp giấy phép vào đây...'
                          : 'Kéo thả ảnh chụp giấy phép vào đây, hoặc bấm để chọn tệp'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 font-medium">
                        Hỗ trợ định dạng: JPG, PNG, WebP (Tối đa 5 MB)
                      </p>
                    </div>
                  )}

                  {fieldErrors.businessLicenseUrl && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.businessLicenseUrl}</p>
                  )}
                </div>

                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                    {submitError}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="w-full rounded-xl bg-brand-teal py-3.5 text-xs font-bold text-white shadow-lg hover:bg-brand-tealDark disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang lưu & gửi lại...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">send</span>
                        <span>Gửi lại hồ sơ xét duyệt</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-4">
              <span className="material-symbols-outlined text-3xl">help_outline</span>
            </div>

            <h3 className="text-center text-lg font-black text-slate-900 tracking-tight">
              Bạn đã chắc chắn thông tin đúng chưa?
            </h3>

            <p className="mt-2 text-center text-xs text-slate-600 leading-relaxed">
              Vui lòng rà soát lại thông tin doanh nghiệp và ảnh giấy phép kinh doanh. Sau khi xác nhận gửi, hồ sơ sẽ được chuyển đến Ban Quản Trị để thẩm định lại.
            </p>

            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Doanh nghiệp:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">{companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mã số thuế:</span>
                <span className="font-semibold text-slate-800">{taxId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Số điện thoại:</span>
                <span className="font-semibold text-slate-800">{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Giấy phép KD:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Đã đính kèm ảnh
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Kiểm tra lại
              </button>

              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-brand-teal py-3 text-xs font-bold text-white shadow-md hover:bg-brand-tealDark disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Xác nhận gửi hồ sơ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationEditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-vietnam text-xs">
          Đang tải form chỉnh sửa...
        </div>
      }
    >
      <ApplicationEditContent />
    </Suspense>
  );
}
