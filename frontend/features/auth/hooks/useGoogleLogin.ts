'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoginWithGoogleMutation } from '../api/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '../store/authSlice';
import { getApiErrorMessage } from '../utils/apiError';
import { LoginResultData } from '../types';
import { GOOGLE_CLIENT_ID, GoogleCredentialResponse, loadGoogleIdentity } from '../utils/googleIdentity';

interface UseGoogleLoginProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
}

/** Time to wait after the popup closes before deciding the user cancelled. */
const CANCEL_GRACE_MS = 1500;

export function useGoogleLogin({ onSuccess, onError }: UseGoogleLoginProps = {}) {
  const dispatch = useAppDispatch();
  const [loginWithGoogle] = useLoginWithGoogleMutation();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buttonHost = useRef<HTMLDivElement | null>(null);
  const awaitingPopup = useRef(false);
  const cancelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onSuccess, onError });
  handlers.current = { onSuccess, onError };

  const clearCancelTimer = () => {
    if (cancelTimer.current) {
      clearTimeout(cancelTimer.current);
      cancelTimer.current = null;
    }
  };

  const fail = useCallback((message: string) => {
    setError(message);
    setNotice(null);
    handlers.current.onError?.(message);
  }, []);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      awaitingPopup.current = false;
      clearCancelTimer();

      if (!response.credential) {
        fail('Không nhận được thông tin xác thực từ Google. Vui lòng thử lại.');
        return;
      }

      setIsLoading(true);
      setError(null);
      setNotice(null);
      try {
        const session = await loginWithGoogle({ idToken: response.credential }).unwrap();
        dispatch(setCredentials({ user: session.user, accessToken: session.accessToken }));
        handlers.current.onSuccess?.({ twoFactorRequired: false, ...session });
      } catch (err) {
        fail(getApiErrorMessage(err, 'Đăng nhập Google thất bại'));
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, fail, loginWithGoogle],
  );

  // Load GIS and render its (invisible) button into the host element.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleIdentity()
      .then((gid) => {
        if (cancelled) return;
        gid.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
        if (buttonHost.current) {
          gid.renderButton(buttonHost.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            width: buttonHost.current.offsetWidth || 340,
          });
        }
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) fail('Không thể tải dịch vụ đăng nhập Google. Vui lòng kiểm tra kết nối mạng và thử lại.');
      });

    return () => {
      cancelled = true;
      clearCancelTimer();
    };
  }, [handleCredential, fail]);

  // The Google popup gives no "closed" callback: if focus returns to the page
  // and no credential arrives shortly after, treat it as a user cancellation.
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingPopup.current) return;
      clearCancelTimer();
      cancelTimer.current = setTimeout(() => {
        if (!awaitingPopup.current) return;
        awaitingPopup.current = false;
        setNotice('Bạn đã hủy đăng nhập bằng Google.');
      }, CANCEL_GRACE_MS);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /** Called on pointer-down over the Google button overlay, before the popup opens. */
  const markPopupOpening = useCallback(() => {
    awaitingPopup.current = true;
    setError(null);
    setNotice(null);
  }, []);

  /** Shown when the user hits the styled button but the SDK cannot work. */
  const reportUnavailable = useCallback(() => {
    fail(
      GOOGLE_CLIENT_ID
        ? 'Dịch vụ đăng nhập Google chưa sẵn sàng. Vui lòng thử lại sau.'
        : 'Đăng nhập bằng Google chưa được cấu hình.',
    );
  }, [fail]);

  return { buttonHost, isReady, isLoading, error, notice, markPopupOpening, reportUnavailable };
}
