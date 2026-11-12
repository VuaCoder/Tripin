import { LoadingState } from '@/components/shared';

export default function BookingEntryLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 h-8 w-48 rounded-xl bg-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-44 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse" />
          <div className="h-64 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-72 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse" />
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <LoadingState label="Đang chuẩn bị trang đặt tour..." />
      </div>
    </div>
  );
}

