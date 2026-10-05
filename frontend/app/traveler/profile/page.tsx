'use client';
import { useState } from 'react';
import { useGetMeQuery, useUpdateMeMutation } from '@/features/traveler-account/api/profileApi';
import { 
  ProfileSkeleton, 
  ProfileSummary, 
  ProfileEditForm 
} from '@/features/traveler-account/components';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';
import type { UpdateProfileRequest } from '@/features/traveler-account/types';

export default function TravelerProfilePage() {
  const { data, isLoading, isError, refetch } = useGetMeQuery();
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();
  const dispatch = useAppDispatch();
  
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (isLoading) return <ProfileSkeleton />;
  
  if (isError || !data?.data) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#BA1A1A] mb-4">Không thể tải thông tin hồ sơ.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-primary text-white rounded-md">
          Thử lại
        </button>
      </div>
    );
  }

  const user = data.data;

  const handleSave = async (payload: UpdateProfileRequest) => {
    if (Object.keys(payload).length === 0) {
      setIsEditing(false);
      return;
    }
    setErrorMsg('');
    try {
      const result = await updateMe(payload).unwrap();
      if (result.success && result.data) {
        dispatch(setUser(result.data));
        setIsEditing(false);
      }
    } catch (err: any) {
      const code = err?.data?.error?.code;
      if (code === 'VALIDATION_ERROR') {
        setErrorMsg('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.');
      } else {
        setErrorMsg('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <div>
      {isEditing ? (
        <ProfileEditForm 
          user={user} 
          onSave={handleSave} 
          onCancel={() => { setIsEditing(false); setErrorMsg(''); }}
          isSaving={isUpdating}
          error={errorMsg}
        />
      ) : (
        <ProfileSummary user={user} onEdit={() => setIsEditing(true)} />
      )}
    </div>
  );
}
