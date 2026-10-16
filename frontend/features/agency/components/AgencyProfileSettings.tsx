'use client';

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, setUser } from '@/features/auth';
import { useUpdateMeMutation, useRemoveAvatarMutation } from '@/features/traveler-account/api/profileApi';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  ShieldCheck, 
  FileText, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  X
} from 'lucide-react';

export function AgencyProfileSettings() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [companyName, setCompanyName] = useState(user?.agencyProfile?.companyName || '');
  const [address, setAddress] = useState(user?.agencyProfile?.address || '');
  const [website, setWebsite] = useState(user?.agencyProfile?.website || '');
  const [licenseNumber, setLicenseNumber] = useState(user?.agencyProfile?.licenseNumber || '');
  const [description, setDescription] = useState(user?.agencyProfile?.description || '');

  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setCompanyName(user.agencyProfile?.companyName || '');
      setAddress(user.agencyProfile?.address || '');
      setWebsite(user.agencyProfile?.website || '');
      setLicenseNumber(user.agencyProfile?.licenseNumber || '');
      setDescription(user.agencyProfile?.description || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const res = await updateMe({
        fullName: fullName.trim(),
        phone: phone.trim() ? phone.trim() : null,
        agencyProfile: {
          companyName: companyName.trim() || undefined,
          address: address.trim() || undefined,
          website: website.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          description: description.trim() || undefined,
        },
      }).unwrap();

      if (res?.data) {
        dispatch(setUser(res.data));
      }
      setIsEditing(false);
      setSaveSuccessMsg('Đã cập nhật thông tin hồ sơ thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setErrorMessage(apiErr?.data?.message || 'Không thể lưu thay đổi. Vui lòng thử lại!');
    }
  };

  const handleClearField = async (field: 'phone' | 'address' | 'website' | 'description' | 'avatar') => {
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      if (field === 'avatar') {
        const res = await removeAvatar().unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setSaveSuccessMsg('Đã xoá ảnh đại diện!');
      } else if (field === 'phone') {
        const res = await updateMe({ phone: null }).unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setPhone('');
        setSaveSuccessMsg('Đã xoá số điện thoại!');
      } else {
        const patch: Record<string, string> = {};
        if (field === 'address') { patch.address = ''; setAddress(''); }
        if (field === 'website') { patch.website = ''; setWebsite(''); }
        if (field === 'description') { patch.description = ''; setDescription(''); }

        const res = await updateMe({ agencyProfile: patch }).unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setSaveSuccessMsg(`Đã xoá dữ liệu ${field}!`);
      }
      setShowDeleteModal(false);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setErrorMessage(apiErr?.data?.message || 'Có lỗi xảy ra khi xoá dữ liệu!');
    }
  };

  const isVerified = user?.agencyProfile?.verificationStatus === 'VERIFIED';

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {saveSuccessMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm animate-fadeIn">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 size-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group size-20 sm:size-24 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-teal-500 to-teal-700 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md shadow-teal-500/20">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span>{user?.fullName?.charAt(0).toUpperCase() || 'A'}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  {user?.agencyProfile?.companyName || user?.fullName}
                </h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  isVerified 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                }`}>
                  <ShieldCheck size={14} className={isVerified ? 'text-emerald-600' : 'text-amber-600'} />
                  {isVerified ? 'Đối tác đã xác thực' : 'Đang duyệt hồ sơ'}
                </span>
              </div>

              <p className="mt-1 text-sm font-medium text-slate-500 truncate">
                Đại diện: <strong className="text-slate-800">{user?.fullName}</strong> • {user?.email}
              </p>

              {user?.agencyProfile?.licenseNumber && (
                <p className="mt-1 text-xs font-semibold text-teal-800 bg-teal-50/80 inline-block px-2.5 py-0.5 rounded-md border border-teal-100">
                  GPKD: {user.agencyProfile.licenseNumber}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 sm:self-center">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary transition cursor-pointer"
                >
                  <Edit3 size={16} />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Xoá thông tin cá nhân"
                >
                  <Trash2 size={16} />
                  <span>Xoá bớt mục</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <X size={16} />
                <span>Huỷ chỉnh sửa</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Information Cards (View Mode vs Edit Mode) */}
      {!isEditing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card 1: Doanh nghiệp & Pháp lý */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-teal-700 pb-2 border-b border-slate-100">
              <Building2 size={18} />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Thông tin doanh nghiệp</h3>
            </div>

            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-400">Tên công ty / Thương hiệu</dt>
                <dd className="mt-0.5 font-bold text-slate-800">
                  {user?.agencyProfile?.companyName || 'Chưa cập nhật'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Số giấy phép KD / Mã số thuế</dt>
                <dd className="mt-0.5 font-bold text-slate-800">
                  {user?.agencyProfile?.licenseNumber || 'Chưa cập nhật'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Trụ sở chính</dt>
                <dd className="mt-0.5 font-medium text-slate-700 flex items-start gap-1.5">
                  <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>{user?.agencyProfile?.address || 'Chưa cập nhật địa chỉ'}</span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Website doanh nghiệp</dt>
                <dd className="mt-0.5 font-medium text-slate-700 flex items-center gap-1.5">
                  <Globe size={16} className="text-slate-400 shrink-0" />
                  {user?.agencyProfile?.website ? (
                    <a href={user.agencyProfile.website} target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline truncate">
                      {user.agencyProfile.website}
                    </a>
                  ) : (
                    <span>Chưa cập nhật website</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Card 2: Người đại diện & Liên hệ */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-teal-700 pb-2 border-b border-slate-100">
              <Mail size={18} />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Người đại diện & Liên hệ</h3>
            </div>

            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-400">Họ và tên người đại diện</dt>
                <dd className="mt-0.5 font-bold text-slate-800">{user?.fullName || 'Chưa cung cấp'}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Email liên lạc chính</dt>
                <dd className="mt-0.5 font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <span>{user?.email}</span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Số điện thoại hotline</dt>
                <dd className="mt-0.5 font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  <span>{user?.phone || 'Chưa cung cấp số điện thoại'}</span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-slate-400">Giới thiệu về đơn vị</dt>
                <dd className="mt-0.5 text-xs text-slate-600 leading-relaxed italic">
                  {user?.agencyProfile?.description ? `"${user.agencyProfile.description}"` : 'Chưa có mô tả giới thiệu.'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        /* Edit Form */
        <form onSubmit={handleSave} className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Edit3 size={18} className="text-primary" />
              <h3 className="text-base font-bold text-slate-900">Cập nhật thông tin đối tác</h3>
            </div>
            <span className="text-xs text-slate-400">Điền các trường cần cập nhật</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Họ và tên người đại diện *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Số điện thoại liên hệ</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Tên công ty / Doanh nghiệp</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Số GPKD / Mã số thuế</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Địa chỉ văn phòng / Trụ sở</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, đường, quận/huyện, tỉnh/TP"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Trang web (Website)</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://congtydulich.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Mô tả tóm tắt doanh nghiệp</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vài câu giới thiệu thế mạnh, loại hình tour chuyên môn..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary transition disabled:opacity-50 cursor-pointer"
            >
              {isUpdating ? 'Đang lưu…' : 'Lưu thông tin'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Huỷ bỏ
            </button>
          </div>
        </form>
      )}

      {/* Delete / Clear Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Trash2 size={18} className="text-rose-600" />
                <span>Xoá bớt thông tin</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Chọn mục thông tin không bắt buộc bạn muốn làm trống khỏi hồ sơ:
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {user?.phone && (
                <button
                  type="button"
                  onClick={() => handleClearField('phone')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/40 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100/70 transition"
                >
                  Xoá SĐT
                </button>
              )}
              {user?.agencyProfile?.address && (
                <button
                  type="button"
                  onClick={() => handleClearField('address')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/40 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100/70 transition"
                >
                  Xoá Địa chỉ
                </button>
              )}
              {user?.agencyProfile?.website && (
                <button
                  type="button"
                  onClick={() => handleClearField('website')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/40 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100/70 transition"
                >
                  Xoá Website
                </button>
              )}
              {user?.avatarUrl && (
                <button
                  type="button"
                  disabled={isRemovingAvatar}
                  onClick={() => handleClearField('avatar')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/40 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100/70 transition disabled:opacity-50"
                >
                  Xoá Avatar
                </button>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
