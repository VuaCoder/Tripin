'use client';
import { useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title: string;
  description: string;
  isConfirming: boolean;
  error?: string;
}

export function ConfirmPasswordModal({ isOpen, onClose, onConfirm, title, description, isConfirming, error }: ConfirmPasswordModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isConfirming) return;
    await onConfirm(password);
    setPassword('');
  };

  const handleClose = () => {
    if (isConfirming) return;
    setPassword('');
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={title} closeOnBackdrop={!isConfirming} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <p className="text-sm leading-6 text-on-surface-variant">{description}</p>

        {error && (
          <div className="rounded-xl border border-error/20 bg-error-container p-3 text-sm font-medium text-on-error-container" role="alert">
            {error}
          </div>
        )}

        <FormField label="Mật khẩu hiện tại" htmlFor="two-factor-password" required>
          <Input
            id="two-factor-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isConfirming}
            required
            autoFocus
          />
        </FormField>

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" onClick={handleClose} disabled={isConfirming} variant="ghost">Hủy</Button>
          <Button type="submit" disabled={!password.trim()} loading={isConfirming} loadingLabel="Đang xử lý...">
            Xác nhận
          </Button>
        </div>
      </form>
    </Modal>
  );
}
