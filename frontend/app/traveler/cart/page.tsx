'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared';

export default function TravelerCartPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tours');
  }, [router]);

  return <LoadingState label="Đang chuyển hướng tới danh sách tour..." className="py-20" />;
}

