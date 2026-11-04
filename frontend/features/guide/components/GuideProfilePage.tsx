'use client';

import { useState } from 'react';
import type { UserProfile } from '@/features/auth/types';
import { Badge, Button } from '@/components/ui';
import { ErrorState } from '@/components/shared';
import { ProfileSkeleton } from '@/features/traveler-account/components';
import { OwnPremiumIdentity, OwnPremiumStatus } from '@/features/premium/PremiumIdentity';
import {
  useCompleteLicenseUploadMutation,
  useCreateLicenseUploadSignatureMutation,
  useGetMeQuery,
  useUpdateMeMutation,
} from '@/features/traveler-account/api/profileApi';
import { uploadImageToCloudinary } from '@/features/traveler-account/api/avatarUpload';
import type { UpdateProfileRequest } from '@/features/traveler-account/types';
import { setUser } from '@/features/auth/store/authSlice';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useAppDispatch } from '@/store/hooks';
import { GuideProfileForm } from './GuideProfileForm';

/** Use cases "View Profile" and "Update Profile" for the logged-in Tour guide. */
export function GuideProfilePage() {
  const { data, isLoading, isError, refetch } = useGetMeQuery();
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();
  const [createLicenseUploadSignature, { isLoading: isPreparingLicense }] = useCreateLicenseUploadSignatureMutation();
  const [completeLicenseUpload, { isLoading: isCompletingLicense }] = useCompleteLicenseUploadMutation();
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async (payload: UpdateProfileRequest, licenseFile: File | null) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (Object.keys(payload).length > 0) {
        const result = await updateMe(payload).unwrap();
        if (result.success && result.data) dispatch(setUser(result.data));
      }
      if (licenseFile) {
        const signature = await createLicenseUploadSignature().unwrap();
        const uploaded = await uploadImageToCloudinary(licenseFile, signature.data);
        const result = await completeLicenseUpload(uploaded).unwrap();
        if (result.success && result.data) dispatch(setUser(result.data));
      }
      setIsEditing(false);
      setSuccessMsg('Thông tin hồ sơ đã được cập nhật.');
    } catch (err: unknown) {
      setErrorMsg(
        getApiErrorCode(err) === 'VALIDATION_ERROR'
          ? 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'
          : getApiErrorMessage(err, 'Đã có lỗi xảy ra. Vui lòng thử lại sau.'),
      );
    }
  };

  return (
    <div className="pb-12">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7 lg:p-8">
        {isLoading ? (
          <ProfileSkeleton />
        ) : isError || !data?.data ? (
          <ErrorState
            title="Không thể tải hồ sơ"
            message="Kết nối tới thông tin tài khoản chưa thành công. Vui lòng thử lại."
            onAction={() => void refetch()}
          />
        ) : isEditing ? (
          <GuideProfileForm
            user={data.data}
            onSave={handleSave}
            onCancel={() => {
              setIsEditing(false);
              setErrorMsg('');
            }}
            isSaving={isUpdating || isPreparingLicense || isCompletingLicense}
            error={errorMsg}
          />
        ) : (
          <GuideProfileSummary
            user={data.data}
            successMsg={successMsg}
            onEdit={() => {
              setSuccessMsg('');
              setErrorMsg('');
              setIsEditing(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

function GuideProfileSummary({
  user,
  successMsg,
  onEdit,
}: {
  user: UserProfile;
  successMsg: string;
  onEdit: () => void;
}) {
  const guide = user.guideProfile;
  const joinedAt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(user.createdAt),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">Hồ sơ Hướng dẫn viên</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Thông tin cá nhân</h1>
          <p className="mt-1 text-sm text-slate-500">Thông tin này hiển thị cho du khách và đại lý phân công tour.</p>
        </div>
        <Button onClick={onEdit} variant="outline" className="self-start">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
          Chỉnh sửa
        </Button>
      </div>

      {successMsg && (
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
          role="status"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 sm:flex-row sm:items-center sm:p-6">
        <OwnPremiumIdentity userId={user.id} url={user.avatarUrl} name={user.fullName} showStatus={false} />
        <div className="min-w-0">
          <div className="truncate text-xl font-extrabold text-slate-900 sm:text-2xl">{user.fullName}</div>
          <OwnPremiumStatus userId={user.id}/>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">Hướng dẫn viên</Badge>
            <Badge variant={user.emailVerifiedAt ? 'success' : 'warning'}>
              {user.emailVerifiedAt ? 'Email đã xác minh' : 'Email chưa xác minh'}
            </Badge>
            <Badge variant={user.status === 'ACTIVE' ? 'success' : 'default'}>
              {user.status === 'ACTIVE' ? 'Đang hoạt động' : user.status}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <ProfileDetail icon="mail" label="Email" value={user.email} />
        <ProfileDetail icon="call" label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} muted={!user.phone} />
        <ProfileDetail icon="calendar_month" label="Ngày tham gia" value={joinedAt} />
        <ProfileDetail
          icon="workspace_premium"
          label="Số năm kinh nghiệm"
          value={guide?.experienceYears != null ? `${guide.experienceYears} năm` : 'Chưa cập nhật'}
          muted={guide?.experienceYears == null}
        />
        <ProfileDetail
          icon="translate"
          label="Ngôn ngữ"
          value={guide?.languages?.length ? guide.languages.join(', ') : 'Chưa cập nhật'}
          muted={!guide?.languages?.length}
        />
        <ProfileDetail
          icon="verified_user"
          label="Số giấy phép hành nghề"
          value={guide?.licenseNumber || 'Chưa cập nhật'}
          muted={!guide?.licenseNumber}
        />
        <div className="sm:col-span-2">
          <div className="flex gap-3">
            <span className="material-symbols-outlined mt-0.5 text-[20px] text-brand-teal" aria-hidden="true">
              badge
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh giấy phép hành nghề</dt>
              {guide?.licenseImageUrl ? (
                <dd className="mt-2">
                  <a href={guide.licenseImageUrl} target="_blank" rel="noreferrer" className="inline-block">
                    {/* Guides paste arbitrary HTTPS hosts, so next/image cannot preconfigure every domain. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={guide.licenseImageUrl}
                      alt="Ảnh giấy phép hành nghề"
                      className="h-32 w-auto rounded-xl border border-slate-200 bg-white object-contain"
                    />
                  </a>
                </dd>
              ) : (
                <dd className="mt-1 text-sm font-semibold text-slate-400">Chưa cập nhật</dd>
              )}
            </div>
          </div>
        </div>
        <div className="sm:col-span-2">
          <ProfileDetail icon="star" label="Chuyên môn" value={guide?.specialties?.length ? guide.specialties.join(', ') : 'Chưa cập nhật'} muted={!guide?.specialties?.length} />
        </div>
        <div className="sm:col-span-2">
          <ProfileDetail icon="person" label="Giới thiệu" value={guide?.bio || 'Chưa cập nhật'} muted={!guide?.bio} />
        </div>
      </dl>
    </div>
  );
}

function ProfileDetail({ icon, label, value, muted = false }: { icon: string; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="material-symbols-outlined mt-0.5 text-[20px] text-brand-teal" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className={`mt-1 whitespace-pre-line break-words text-sm font-semibold ${muted ? 'text-slate-400' : 'text-slate-800'}`}>
          {value}
        </dd>
      </div>
    </div>
  );
}
