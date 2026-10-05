'use client';

import React from 'react';
import { useGoogleLogin } from '../hooks/useGoogleLogin';
import { LoginResultData } from '../types';

interface GoogleLoginButtonProps {
  onSuccess?: (data: LoginResultData) => void;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Keeps the Tripri-styled button; Google's own (invisible) button is laid over it
 * so the click opens the real GIS popup and yields an ID token for the backend.
 */
export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onSuccess, onError, disabled, label = 'Đăng nhập bằng Google' }) => {
  const { buttonHost, isReady, isLoading, error, notice, markPopupOpening, reportUnavailable } = useGoogleLogin({
    onSuccess,
    onError,
  });

  const busy = isLoading || disabled;

  return (
    <div className="w-full">
      <div className="relative w-full">
        <button
          type="button"
          disabled={busy}
          onClick={isReady ? undefined : reportUnavailable}
          className="w-full py-2.5 px-6 rounded-full bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 font-semibold text-sm border border-slate-300 shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>{label}</span>
            </>
          )}
        </button>

        {/* Google's real button, transparent, capturing the click above our styled one */}
        <div
          ref={buttonHost}
          onPointerDownCapture={markPopupOpening}
          aria-hidden="true"
          className={`absolute inset-0 overflow-hidden rounded-full opacity-[0.01] ${
            isReady && !busy ? '' : 'pointer-events-none'
          }`}
        />
      </div>

      {notice && (
        <p role="status" className="mt-2 text-xs text-slate-500 text-center font-vietnam">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 text-center font-vietnam">
          {error}
        </p>
      )}
    </div>
  );
};
