'use client';
import { useState, type ReactNode } from 'react';
import { useGetSecuritySettingsQuery, useSetTwoFactorMutation } from '@/features/traveler-account/api/securityApi';
import { TwoFactorCard, ConfirmPasswordModal, ProfileSkeleton, TravelerAccountShell } from '@/features/traveler-account/components';
import { ErrorState } from '@/components/shared';
import { useAppDispatch } from '@/store/hooks';
import { setUser } from '@/features/auth/store/authSlice';
import { getApiErrorCode } from '@/features/auth/utils/apiError';

export default function SecuritySettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSecuritySettingsQuery();
  const [setTwoFactor, { isLoading: isMutating }] = useSetTwoFactorMutation();
  const dispatch = useAppDispatch();
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    targetEnabled: boolean;
    error: string;
  }>({ isOpen: false, targetEnabled: false, error: '' });
  const [successMsg, setSuccessMsg] = useState('');

  const handleToggle = (enable: boolean) => {
    setSuccessMsg('');
    setModalState({ isOpen: true, targetEnabled: enable, error: '' });
  };

  const handleConfirm = async (password: string) => {
    setModalState(prev => ({ ...prev, error: '' }));
    try {
      const result = await setTwoFactor({ enabled: modalState.targetEnabled, password }).unwrap();
      if (result.success && result.data) {
        dispatch(setUser(result.data));
      }
      setSuccessMsg(
        modalState.targetEnabled
          ? 'Xác thực hai lớp đã được bật cho đăng nhập bằng mật khẩu.'
          : 'Xác thực hai lớp đã được tắt.',
      );
      setModalState({ isOpen: false, targetEnabled: false, error: '' });
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
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

  const modalTitle = modalState.targetEnabled ? 'Bật xác thực hai lớp' : 'Tắt xác thực hai lớp';
  const modalDescription = modalState.targetEnabled
    ? 'Sau khi bật, mã xác thực sẽ được gửi tới email của bạn mỗi khi đăng nhập bằng email và mật khẩu. Vui lòng xác nhận mật khẩu để tiếp tục.'
    : 'Sau khi tắt, tài khoản sẽ không yêu cầu mã OTP khi đăng nhập bằng mật khẩu. Vui lòng xác nhận mật khẩu để tiếp tục.';

  let content: ReactNode;
  if (isLoading) {
    content = <ProfileSkeleton />;
  } else if (isError || !data?.data) {
    content = (
      <ErrorState
        title="Không thể tải cài đặt bảo mật"
        message="Kết nối tới cài đặt 2FA chưa thành công. Vui lòng thử lại."
        onAction={() => void refetch()}
      />
    );
  } else {
    content = (
      <div className="space-y-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Bảo mật tài khoản</p>
          <h2 className="mt-1 text-headline-md font-bold text-on-surface">Bảo mật & đăng nhập</h2>
          <p className="mt-1 text-sm leading-6 text-on-surface-variant">
            Kiểm soát lớp xác thực bổ sung cho tài khoản Traveler của bạn.
          </p>
        </div>

        {successMsg && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800" role="status">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <TwoFactorCard settings={data.data} onToggle={handleToggle} />

        <div className="flex gap-3 rounded-2xl border border-surface-container bg-surface-container-low/50 p-5 text-sm leading-6 text-on-surface-variant">
          <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary" aria-hidden="true">mark_email_read</span>
          <p>
            Khi 2FA được bật, Tripri chỉ tạo phiên đăng nhập sau khi mật khẩu và mã OTP gửi qua email đều hợp lệ.
          </p>
        </div>

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

  return (
    <TravelerAccountShell>{content}</TravelerAccountShell>
  );
}
