'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '@/features/auth/utils/googleIdentity';

function MobileAuthContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'TRAVELER';
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleIdentity()
      .then((gid) => {
        if (cancelled) return;
        gid.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (!response.credential) {
              setStatus('error');
              setErrorMessage('Không nhận được thông tin xác thực từ Google. Vui lòng thử lại.');
              return;
            }

            const targetDeepLink = `tripri://auth/callback?idToken=${encodeURIComponent(response.credential)}&role=${encodeURIComponent(role)}`;
            setDeepLink(targetDeepLink);
            setStatus('success');

            // Auto-redirect back to mobile app
            window.location.href = targetDeepLink;
          },
        });

        if (buttonContainerRef.current) {
          gid.renderButton(buttonContainerRef.current, {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            width: 320,
          });
        }
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Không thể tải dịch vụ Google. Vui lòng kiểm tra kết nối mạng.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center flex flex-col items-center">
        {/* App Logo / Branding */}
        <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-2xl mb-4 shadow-lg shadow-teal-600/20">
          T
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">Xác thực tài khoản Tripri</h1>
        <p className="text-xs text-slate-500 mb-6">
          {status === 'success'
            ? 'Đăng nhập Google thành công! Đang chuyển tiếp về ứng dụng Tripri...'
            : 'Chọn tài khoản Google của bạn để tiếp tục vào ứng dụng'}
        </p>

        {status === 'loading' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Đang khởi tạo dịch vụ Google...</span>
          </div>
        )}

        {status === 'ready' && (
          <div className="w-full flex justify-center py-4">
            <div ref={buttonContainerRef} className="w-full flex justify-center min-h-[44px]" />
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 flex flex-col items-center gap-4 w-full">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold">
              ✓
            </div>
            <p className="text-sm font-semibold text-emerald-700">Đăng nhập thành công!</p>
            {deepLink && (
              <a
                href={deepLink}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-teal-600/20"
              >
                Mở ứng dụng Tripri
              </a>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 text-xs text-red-600 bg-red-50 p-4 rounded-xl w-full mb-4">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          Bảo mật bởi Google Identity Services
        </div>
      </div>
    </div>
  );
}

export default function MobileAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Đang tải...</div>}>
      <MobileAuthContent />
    </Suspense>
  );
}
