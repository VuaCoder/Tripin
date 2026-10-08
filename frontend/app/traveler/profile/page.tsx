'use client';

import { useState, type ReactNode } from 'react';
import {
  useCompleteAvatarUploadMutation,
  useCreateAvatarUploadSignatureMutation,
  useGetMeQuery,
  useRemoveAvatarMutation,
  useUpdateMeMutation,
} from '@/features/traveler-account/api/profileApi';
import { uploadAvatarFile } from '@/features/traveler-account/api/avatarUpload';
import {
  ProfileSkeleton,
  ProfileSummary,
  ProfileEditForm,
  TravelerAccountShell,
} from '@/features/traveler-account/components';
import { ErrorState } from '@/components/shared';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import type { AvatarChange, UpdateProfileRequest } from '@/features/traveler-account/types';

export default function TravelerProfilePage() {
  const { data, isLoading, isError, refetch } = useGetMeQuery();
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();
  const [createAvatarUploadSignature, { isLoading: isPreparingAvatar }] = useCreateAvatarUploadSignatureMutation();
  const [completeAvatarUpload, { isLoading: isCompletingAvatar }] = useCompleteAvatarUploadMutation();
  const [removeAvatar, { isLoading: isRemovingAvatar }] = useRemoveAvatarMutation();
  const dispatch = useAppDispatch();

  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async (payload: UpdateProfileRequest, avatarChange: AvatarChange) => {
    if (Object.keys(payload).length === 0 && avatarChange.kind === 'unchanged') {
      setIsEditing(false);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (Object.keys(payload).length > 0) {
        const result = await updateMe(payload).unwrap();
        if (result.success && result.data) dispatch(setUser(result.data));
      }

      if (avatarChange.kind === 'upload') {
        const signature = await createAvatarUploadSignature().unwrap();
        const uploaded = await uploadAvatarFile(avatarChange.file, signature.data);
        const result = await completeAvatarUpload(uploaded).unwrap();
        if (result.success && result.data) dispatch(setUser(result.data));
      } else if (avatarChange.kind === 'remove') {
        const result = await removeAvatar().unwrap();
        if (result.success && result.data) dispatch(setUser(result.data));
      }

      setIsEditing(false);
      setSuccessMsg('Thông tin hồ sơ đã được cập nhật.');
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      if (code === 'VALIDATION_ERROR') {
        setErrorMsg('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.');
      } else {
        setErrorMsg(getApiErrorMessage(err, 'Đã có lỗi xảy ra. Vui lòng thử lại sau.'));
      }
    }
  };

  let content: ReactNode;
  if (isLoading) {
    content = <ProfileSkeleton />;
  } else if (isError || !data?.data) {
    content = (
      <ErrorState
        title="Không thể tải hồ sơ"
        message="Kết nối tới thông tin tài khoản chưa thành công. Vui lòng thử lại."
        onAction={() => void refetch()}
      />
    );
  } else {
    const user = data.data;
    content = (
      <>
        {successMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800" role="status">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}
        {isEditing ? (
          <ProfileEditForm
            user={user}
            onSave={handleSave}
            onCancel={() => {
              setIsEditing(false);
              setErrorMsg('');
            }}
            isSaving={isUpdating || isPreparingAvatar || isCompletingAvatar || isRemovingAvatar}
            error={errorMsg}
          />
        ) : (
          <ProfileSummary
            user={user}
            onEdit={() => {
              setSuccessMsg('');
              setIsEditing(true);
            }}
          />
        )}
      </>
    );
  }

  return <TravelerAccountShell>{content}</TravelerAccountShell>;
}
