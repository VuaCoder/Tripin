'use client';
import { useState } from 'react';

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title: string;
  description: string;
  isConfirming: boolean;
  error?: string;
}

export function ConfirmPasswordModal({ isOpen, onClose, onConfirm, title, description, isConfirming, error }: ConfirmPasswordModalProps) {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isConfirming) return;
    onConfirm(password);
    setPassword('');
  };

  const handleClose = () => {
    if (isConfirming) return;
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-ink/50 backdrop-blur-sm">
      <div className="bg-surface-containerLowest rounded-xl shadow-elevation3 w-full max-w-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <h3 className="text-headline-sm text-brand-ink mb-2">{title}</h3>
            <p className="text-sm text-brand-slate">{description}</p>
          </div>

          {error && (
            <div className="p-3 bg-[#FFDAD6] text-[#93000A] rounded-md text-sm border border-[#BA1A1A]/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-brand-ink mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConfirming}
              className="w-full px-4 py-2 rounded-md border border-brand-border focus:outline-none focus:border-brand-primary text-brand-ink"
              required
            />
          </div>

          <div className="flex gap-4 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-semibold text-brand-slate hover:bg-surface-container rounded-md transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!password.trim() || isConfirming}
              className="px-6 py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-primaryDark rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? 'Đang xử lý...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
