'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircleMore } from 'lucide-react';
import { useStartConversationMutation } from './api';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
import { usePreloader } from '@/components/preloader';

export interface StartConversationButtonProps {
  participantId: string;
  tourId: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
  onGuestClick?: () => void;
}

export function StartConversationButton({
  participantId,
  tourId,
  label = 'Nhắn tin cho hướng dẫn viên',
  className,
  iconOnly = false,
  onGuestClick,
}: StartConversationButtonProps) {
  const [start, { isLoading }] = useStartConversationMutation();
  const { start: startPreloader, stop: stopPreloader } = usePreloader();
  const [isNavigating, setIsNavigating] = useState(false);
  const busy = isLoading || isNavigating;
  const [error, setError] = useState('');
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Prefetch conversation routes so navigation is near-instantaneous
  const handlePrefetch = useCallback(() => {
    if (user) {
      router.prefetch('/conversations');
    }
  }, [user, router]);

  useEffect(() => {
    handlePrefetch();
  }, [handlePrefetch]);

  const handleClick = async () => {
    if (!user) {
      if (onGuestClick) onGuestClick();
      else router.push(`/login?from=/tours/${tourId}`);
      return;
    }
    if (busy) return;
    setError('');
    setIsNavigating(true);
    startPreloader();
    const requestOwner = owner.current;
    try {
      const conversation = await start({ participantId, tourId }).unwrap();
      if (mounted.current && owner.current === requestOwner) {
        router.push(`/conversations/${conversation.id}`);
      }
    } catch (err) {
      stopPreloader();
      if (mounted.current && owner.current === requestOwner) {
        setIsNavigating(false);
        setError(getApiErrorMessage(err, 'Không thể tạo cuộc trò chuyện. Vui lòng thử lại.'));
      }
    }
  };

  const defaultBtnClass = iconOnly
    ? 'grid size-9 place-items-center rounded-xl border border-teal-200 bg-teal-50/60 text-teal-800 hover:bg-teal-100/70 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer'
    : 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer';

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        title={label}
        className={className ?? defaultBtnClass}
        onClick={handleClick}
        onMouseEnter={handlePrefetch}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin text-teal-700" />
        ) : (
          <MessageCircleMore size={18} className="text-teal-700 shrink-0" />
        )}
        {!iconOnly && <span>{busy ? 'Đang mở cuộc trò chuyện…' : label}</span>}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
