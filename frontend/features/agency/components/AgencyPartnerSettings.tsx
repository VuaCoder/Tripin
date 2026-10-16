'use client';

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, setUser } from '@/features/auth';
import { useUpdateMeMutation, useRemoveAvatarMutation } from '@/features/traveler-account/api/profileApi';
import { CounterUp } from '@/components/ui/CounterUp';

const formatMoney = (val: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(val))} ₫`;

export function AgencyPartnerSettings({ onClose }: { onClose?: () => void }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);

  const [activeSection, setActiveSection] = useState<'profile' | 'commission'>('commission');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [companyName, setCompanyName] = useState(user?.agencyProfile?.companyName || '');
  const [address, setAddress] = useState(user?.agencyProfile?.address || '');
  const [website, setWebsite] = useState(user?.agencyProfile?.website || '');
  const [licenseNumber, setLicenseNumber] = useState(user?.agencyProfile?.licenseNumber || '');
  const [description, setDescription] = useState(user?.agencyProfile?.description || '');

  // Commission & Product Discount Rate State
  const storageKey = user?.id ? `tripri_agency_discount_rate_${user.id}` : 'tripri_agency_discount_rate';
  const [commissionRate, setCommissionRate] = useState<number>(10.0);
  const [samplePrice, setSamplePrice] = useState<number>(3500000);
  const [commissionSaved, setCommissionSaved] = useState(false);

  // API mutations
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();

  // Load saved commission rate from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
          setCommissionRate(parsed);
        }
      }
    }
  }, [storageKey]);

  // Sync profile fields if user changes
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

  const handleSaveProfile = async (e: React.FormEvent) => {
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
      setIsEditingProfile(false);
      setSaveSuccessMsg('Đã cập nhật thông tin thành công!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setErrorMessage(apiErr?.data?.message || 'Không thể lưu thay đổi. Vui lòng kiểm tra lại!');
    }
  };

  const handleClearField = async (field: 'phone' | 'address' | 'website' | 'description' | 'avatar') => {
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      if (field === 'avatar') {
        const res = await removeAvatar().unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setSaveSuccessMsg('Đã xoá ảnh đại diện thành công!');
      } else if (field === 'phone') {
        const res = await updateMe({ phone: null }).unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setPhone('');
        setSaveSuccessMsg('Đã xoá số điện thoại thành công!');
      } else {
        const patch: Record<string, string> = {};
        if (field === 'address') {
          patch.address = '';
          setAddress('');
        }
        if (field === 'website') {
          patch.website = '';
          setWebsite('');
        }
        if (field === 'description') {
          patch.description = '';
          setDescription('');
        }

        const res = await updateMe({
          agencyProfile: patch,
        }).unwrap();
        if (res?.data) dispatch(setUser(res.data));
        setSaveSuccessMsg(`Đã xoá thông tin ${field} thành công!`);
      }
      setShowDeleteModal(false);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setErrorMessage(apiErr?.data?.message || 'Có lỗi xảy ra khi xoá dữ liệu!');
    }
  };

  const handleSaveCommission = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, commissionRate.toString());
    }
    setCommissionSaved(true);
    setTimeout(() => setCommissionSaved(false), 2500);
  };

  // Calculations for commission counter
  const calculatedCommission = (samplePrice * commissionRate) / 100;
  const calculatedNetRevenue = samplePrice - calculatedCommission;
  const partnerRetentionRate = 100 - commissionRate;

  return (
    <div className="flex flex-col h-full overflow-y-auto text-slate-800">
      {/* Settings Top Header Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/90 bg-white/95 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-primary">
            <span className="material-symbols-outlined text-[22px]">tune</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Cài đặt Đối tác</h2>
            <p className="text-xs text-slate-500">Quản lý hồ sơ & chiết khấu sản phẩm</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            title="Đóng cài đặt"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Segmented Switcher / Tabs */}
      <div className="p-4 pb-2">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSection('commission')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeSection === 'commission'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">percent</span>
            <span>Hoa hồng & Chiết khấu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeSection === 'profile'
                ? 'bg-white text-primary shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">badge</span>
            <span>Hồ sơ Đối tác</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Alert */}
      {saveSuccessMsg && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800 animate-fadeIn">
          <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800 animate-fadeIn">
          <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: COMMISSION & DISCOUNT RATE */}
      {activeSection === 'commission' && (
        <div className="space-y-5 p-4 pt-1">
          {/* Main Hero Card for Commission Animation */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-5 text-white shadow-lg">
            <div className="absolute -right-6 -bottom-6 size-32 rounded-full bg-teal-500/10 blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-[11px] font-semibold text-teal-300 backdrop-blur-sm">
                <span className="material-symbols-outlined text-[14px]">price_change</span>
                Mức chiết khấu thoả thuận
              </span>
              <span className="text-[11px] text-slate-300">Live Counter</span>
            </div>

            {/* Counter-Up Large Display */}
            <div className="mt-4 flex items-baseline gap-2">
              <CounterUp
                value={commissionRate}
                decimals={1}
                duration={700}
                className="text-4xl sm:text-5xl font-black tracking-tight text-white"
              />
              <span className="text-2xl font-bold text-teal-400">%</span>
            </div>

            <p className="mt-1 text-xs text-slate-300">
              Chiết khấu hoa hồng áp dụng giữa Agency và các sản phẩm tour.
            </p>

            {/* Stepper controls */}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommissionRate((prev) => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
                className="flex size-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
                title="Giảm 0.5%"
              >
                <span className="material-symbols-outlined text-[18px]">remove</span>
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="0.5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-2 bg-white/20 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => setCommissionRate((prev) => Math.min(40, Math.round((prev + 0.5) * 10) / 10))}
                className="flex size-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
                title="Tăng 0.5%"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[5, 8, 10, 12, 15, 20].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setCommissionRate(rate)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    commissionRate === rate
                      ? 'bg-teal-400 text-slate-950 shadow-sm'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          {/* Realtime Product Calculator / Simulation with Counter-Up */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">calculate</span>
                <h3 className="text-sm font-bold text-slate-900">Mô phỏng doanh thu theo sản phẩm</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Tự động tính</span>
            </div>

            <div className="mt-3.5">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Giá niêm yết sản phẩm mẫu (Gross Price):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="100000"
                  step="100000"
                  value={samplePrice}
                  onChange={(e) => setSamplePrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 py-2 pl-3 pr-10 text-sm font-bold text-slate-900 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">₫</span>
              </div>

              {/* Sample Price Shortcuts */}
              <div className="mt-2 flex gap-1.5">
                {[1500000, 3500000, 6000000, 10000000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSamplePrice(preset)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                      samplePrice === preset
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {(preset / 1000000).toFixed(1)} tr
                  </button>
                ))}
              </div>
            </div>

            {/* Computed Results Grid with CounterUp */}
            <div className="mt-4 space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">savings</span>
                  <span className="text-xs font-medium text-slate-600">Hoa hồng chiết khấu:</span>
                </div>
                <CounterUp
                  value={calculatedCommission}
                  duration={750}
                  formatter={formatMoney}
                  className="text-sm font-extrabold text-amber-700"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-teal-50/80 border border-teal-100 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-teal-700">payments</span>
                  <span className="text-xs font-bold text-teal-900">Agency thực nhận (Net):</span>
                </div>
                <CounterUp
                  value={calculatedNetRevenue}
                  duration={750}
                  formatter={formatMoney}
                  className="text-base font-black text-teal-800"
                />
              </div>

              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
                <span>Tỷ lệ doanh thu giữ lại:</span>
                <span className="font-bold text-slate-700">
                  <CounterUp value={partnerRetentionRate} decimals={1} duration={600} suffix="%" />
                </span>
              </div>
            </div>

            {/* Save Preference Button */}
            <button
              type="button"
              onClick={handleSaveCommission}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
                commissionSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary-container text-white hover:bg-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {commissionSaved ? 'check' : 'bookmark'}
              </span>
              <span>{commissionSaved ? 'Đã lưu mức chiết khấu!' : 'Lưu mức chiết khấu này'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE & PERSONAL INFO */}
      {activeSection === 'profile' && (
        <div className="space-y-4 p-4 pt-1">
          {/* Partner Identity Card */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-xl font-bold text-primary ring-1 ring-black/5">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span>{user?.fullName?.charAt(0).toUpperCase() || 'P'}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-bold text-slate-900">
                  {user?.agencyProfile?.companyName || user?.fullName}
                </h3>
              </div>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  {user?.agencyProfile?.verificationStatus === 'VERIFIED' ? 'Đã xác thực' : 'Đối tác Agency'}
                </span>
                {user?.phone && (
                  <span className="text-[11px] text-slate-400 truncate">{user.phone}</span>
                )}
              </div>
            </div>
          </div>

          {/* View Mode vs Edit Mode */}
          {!isEditingProfile ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Thông tin cá nhân & Doanh nghiệp
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-primary hover:bg-teal-50 transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Xoá
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Họ và tên:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{user?.fullName || 'Chưa cung cấp'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Số điện thoại:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{user?.phone || 'Chưa cung cấp'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Tên công ty / Thương hiệu:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {user?.agencyProfile?.companyName || 'Chưa cập nhật'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Địa chỉ trụ sở:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {user?.agencyProfile?.address || 'Chưa cập nhật'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Website doanh nghiệp:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {user?.agencyProfile?.website ? (
                      <a
                        href={user.agencyProfile.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {user.agencyProfile.website}
                      </a>
                    ) : (
                      'Chưa cập nhật'
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Giấy phép KD / Mã số thuế:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {user?.agencyProfile?.licenseNumber || 'Chưa cập nhật'}
                  </p>
                </div>
                {user?.agencyProfile?.description && (
                  <div>
                    <span className="text-slate-400 font-medium">Mô tả doanh nghiệp:</span>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      {user.agencyProfile.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit Mode Form */
            <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
                  Chỉnh sửa thông tin
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Huỷ
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Họ và tên người đại diện *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Tên công ty / Doanh nghiệp
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Địa chỉ văn phòng
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/TP"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Website (bắt đầu bằng http:// hoặc https://)
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Số giấy phép KD / Giấy phép lữ hành
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Giới thiệu tóm tắt
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Vài câu giới thiệu năng lực doanh nghiệp..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 rounded-xl bg-primary-container py-2 text-xs font-bold text-white shadow-sm hover:bg-primary disabled:opacity-50"
                >
                  {isUpdating ? 'Đang lưu…' : 'Lưu thông tin'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Huỷ
                </button>
              </div>
            </form>
          )}

          {/* Delete / Clear Modal */}
          {showDeleteModal && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Xoá thông tin cá nhân
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Đóng
                </button>
              </div>
              <p className="text-[11px] text-red-700 leading-normal">
                Chọn mục thông tin bạn muốn xoá hoặc làm trống khỏi hồ sơ đối tác:
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {user?.phone && (
                  <button
                    type="button"
                    onClick={() => handleClearField('phone')}
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-2 text-red-700 font-semibold hover:bg-red-50"
                  >
                    Xoá SĐT
                  </button>
                )}
                {user?.agencyProfile?.address && (
                  <button
                    type="button"
                    onClick={() => handleClearField('address')}
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-2 text-red-700 font-semibold hover:bg-red-50"
                  >
                    Xoá Địa chỉ
                  </button>
                )}
                {user?.agencyProfile?.website && (
                  <button
                    type="button"
                    onClick={() => handleClearField('website')}
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-2 text-red-700 font-semibold hover:bg-red-50"
                  >
                    Xoá Website
                  </button>
                )}
                {user?.avatarUrl && (
                  <button
                    type="button"
                    disabled={isRemovingAvatar}
                    onClick={() => handleClearField('avatar')}
                    className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-2 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    Xoá Avatar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
