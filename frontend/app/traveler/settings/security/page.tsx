'use client';
import { useState } from 'react';
import { useGetSecuritySettingsQuery, useSetTwoFactorMutation } from '@/features/traveler-account/api/securityApi';
import { TwoFactorCard, ConfirmPasswordModal, ProfileSkeleton } from '@/features/traveler-account/components';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';

export default function SecuritySettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSecuritySettingsQuery();
  const [setTwoFactor, { isLoading: isMutating }] = useSetTwoFactorMutation();
  const dispatch = useAppDispatch();
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    targetEnabled: boolean;
    error: string;
  }>({ isOpen: false, targetEnabled: false, error: '' });

  const handleToggle = (enable: boolean) => {
    setModalState({ isOpen: true, targetEnabled: enable, error: '' });
  };

  const handleConfirm = async (password: string) => {
    setModalState(prev => ({ ...prev, error: '' }));
    try {
      const result = await setTwoFactor({ enabled: modalState.targetEnabled, password }).unwrap();
      if (result.success && result.data) {
        dispatch(setUser(result.data));
      }
      setModalState({ isOpen: false, targetEnabled: false, error: '' });
    } catch (err: any) {
      const code = err?.data?.error?.code;
      if (code === 'INVALID_CREDENTIALS') {
        setModalState(prev => ({ ...prev, error: 'Mật khẩu hiện tại không chính xác.' }));
      } else if (code === 'TWO_FACTOR_REQUIRES_PASSWORD') {
        setModalState(prev => ({ ...prev, error: 'Tài khoản Google chưa có mật khẩu, không thể bật 2FA.' }));
      } else {
        setModalState(prev => ({ ...prev, error: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' }));
      }
    }
  };

  const handleCloseModal = () => {
    if (isMutating) return;
    setModalState({ isOpen: false, targetEnabled: false, error: '' });
  };

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !data?.data) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#BA1A1A] mb-4">Không thể tải thông tin bảo mật.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-primary text-white rounded-md">
          Thử lại
        </button>
      </div>
    );
  }

  const settings = data.data;
  
  const modalTitle = modalState.targetEnabled ? 'Bật xác thực hai lớp' : 'Tắt xác thực hai lớp';
  const modalDescription = modalState.targetEnabled 
    ? 'Sau khi bật, mã xác thực sẽ được gửi tới email của bạn mỗi khi đăng nhập bằng email và mật khẩu. Vui lòng xác nhận mật khẩu để tiếp tục.'
    : 'Sau khi tắt, tài khoản sẽ không yêu cầu mã OTP khi đăng nhập bằng mật khẩu. Vui lòng xác nhận mật khẩu để tiếp tục.';

  return (
    <div className="space-y-6">
      <h2 className="text-headline-md text-brand-ink">Bảo mật & Đăng nhập</h2>
      
      <TwoFactorCard settings={settings} onToggle={handleToggle} />

      <ConfirmPasswordModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirm}
        title={modalTitle}
        description={modalDescription}
        isConfirming={isMutating}
        error={modalState.error}
      />
    </div>
  );
}
