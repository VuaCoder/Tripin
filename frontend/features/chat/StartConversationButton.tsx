'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStartConversationMutation } from './api';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth/store/authSlice';
export function StartConversationButton({ participantId, tourId }: { participantId: string; tourId: string }) {
  const [start, { isLoading }] = useStartConversationMutation();
  const [error, setError] = useState('');
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <div className="mt-4">
    <button type="button" disabled={isLoading} className="rounded-lg bg-primary-container px-4 py-3 font-semibold text-white disabled:opacity-50" onClick={async () => {
      setError('');
      const requestOwner = owner.current;
      try { const conversation = await start({ participantId, tourId }).unwrap(); if (mounted.current && owner.current === requestOwner) router.push(`/conversations/${conversation.id}`); }
      catch (error) { if (mounted.current && owner.current === requestOwner) setError(getApiErrorMessage(error, 'Không thể tạo cuộc trò chuyện. Vui lòng thử lại.')); }
    }}>{isLoading ? 'Đang mở cuộc trò chuyện…' : 'Nhắn tin cho hướng dẫn viên'}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
