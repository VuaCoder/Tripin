import React from 'react';

export function VoucherSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Đang tải ví voucher...">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="size-10 rounded-xl bg-slate-200" />
        <div className="space-y-1.5">
          <div className="h-6 w-44 rounded-lg bg-slate-200" />
          <div className="h-3.5 w-72 rounded bg-slate-100" />
        </div>
      </div>

      {/* Filter Tabs skeleton */}
      <div className="flex gap-4 border-b border-slate-200 pb-3">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="h-5 w-24 rounded bg-slate-100" />
        <div className="h-5 w-24 rounded bg-slate-100" />
      </div>

      {/* Voucher Ticket Cards skeleton */}
      <div className="space-y-4 pt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative overflow-hidden flex flex-col sm:flex-row items-stretch rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs gap-4 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-slate-100/60 before:to-transparent"
          >
            <div className="size-16 rounded-xl bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 w-2/3 max-w-sm rounded-md bg-slate-200" />
              <div className="h-3.5 w-1/2 max-w-xs rounded bg-slate-100" />
              <div className="h-3 w-40 rounded bg-slate-100" />
            </div>
            <div className="self-center sm:self-auto sm:border-l sm:border-slate-100 sm:pl-5 flex flex-col justify-center items-end gap-2">
              <div className="h-7 w-24 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải ví voucher...</span>
    </div>
  );
}

