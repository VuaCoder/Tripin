import React from 'react';

export function BookingHistorySkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Đang tải danh sách đặt chỗ của bạn">
      {/* Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 rounded-xl bg-slate-200 shrink-0" />
        ))}
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-4"
          >
            {/* Top row: Code + date + status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 rounded bg-slate-200" />
                <div className="h-5 w-24 rounded bg-slate-100" />
                <div className="h-4 w-32 rounded bg-slate-100" />
              </div>
              <div className="h-6 w-24 rounded-full bg-slate-200" />
            </div>

            {/* Middle row: Image + Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-20 w-28 sm:h-24 sm:w-32 rounded-2xl bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2 w-full">
                <div className="h-5 w-4/5 max-w-md rounded bg-slate-200" />
                <div className="h-4 w-52 rounded bg-slate-100" />
                <div className="h-4 w-40 rounded bg-slate-100" />
              </div>
            </div>

            {/* Bottom row: Price + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <div className="h-3 w-20 rounded bg-slate-100" />
                <div className="h-6 w-32 rounded bg-slate-200" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-10 w-24 rounded-xl bg-slate-200" />
                <div className="h-10 w-28 rounded-xl bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Đang tải danh sách đặt chỗ của bạn...</span>
    </div>
  );
}
