'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircleMore } from 'lucide-react';
import { useStartConversationMutation } from './api';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';

export interface StartConversationButtonProps {
  participantId: string;
  tourId: string;
  label?: string;
  className?: string;
  onGuestClick?: () => void;
}

export function StartConversationButton({
  participantId,
  tourId,
  label = 'Nhắn tin cho hướng dẫn viên',
  className,
  onGuestClick,
}: StartConversationButtonProps) {
  const [start, { isLoading }] = useStartConversationMutation();
  const [error, setError] = useState('');
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const handleClick = async () => {
    if (!user) {
      if (onGuestClick) onGuestClick();
      else router.push(`/login?from=/tours/${tourId}`);
      return;
    }
    setError('');
    const requestOwner = owner.current;
    try {
      const conversation = await start({ participantId, tourId }).unwrap();
      if (mounted.current && owner.current === requestOwner) router.push(`/conversations/${conversation.id}`);
    } catch (err) {
      if (mounted.current && owner.current === requestOwner) {
        setError(getApiErrorMessage(err, 'Không thể tạo cuộc trò chuyện. Vui lòng thử lại.'));
      }
    }
  };

  const defaultBtnClass = "rounded-lg bg-primary-container px-4 py-3 font-semibold text-white disabled:opacity-50";

  return (
    <div>
      <button
        type="button"
        disabled={isLoading}
        className={className ?? defaultBtnClass}
        onClick={handleClick}
      >
        <MessageCircleMore size={16} className="text-teal-700 shrink-0" />
        <span>{isLoading ? 'Đang mở cuộc trò chuyện…' : label}</span>
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
