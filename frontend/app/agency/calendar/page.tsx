'use client';

import dynamic from 'next/dynamic';
const AgencyCalendarPage = dynamic(() => import('@/features/agency-calendar/AgencyCalendarPage'), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-[1600px] space-y-6 p-6" role="status"><h1 className="text-2xl font-bold text-slate-900">Lịch khởi hành</h1><div className="h-[620px] animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" /><span className="sr-only">Đang mở lịch…</span></main>,
});
export default AgencyCalendarPage;
