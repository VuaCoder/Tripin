import React from 'react';

export function WishlistSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-12 animate-pulse" role="status" aria-label="Đang tải danh sách yêu thích">
      {/* Header skeleton */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-xl bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-slate-200" />
      </header>

      {/* Item cards skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            {/* Thumbnail */}
            <div className="h-24 w-24 shrink-0 rounded-xl bg-slate-200" />

            {/* Content */}
            <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
              <div className="space-y-2">
                <div className="h-4 w-3/4 max-w-md rounded bg-slate-200" />
                <div className="h-3 w-40 rounded bg-slate-100" />
                <div className="h-3 w-52 rounded bg-slate-100" />
              </div>

              {/* Bottom row: price placeholder */}
              <div className="flex items-center justify-between pt-2">
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="h-8 w-20 rounded-lg bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Đang tải danh sách yêu thích...</span>
    </div>
  );
}
