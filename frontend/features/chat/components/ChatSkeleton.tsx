import React from 'react';

/** Skeleton loading cho danh sách cuộc trò chuyện bên sidebar */
export function ConversationListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải danh sách cuộc trò chuyện"
      className="flex-1 divide-y divide-slate-100 overflow-hidden animate-pulse"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3.5 sm:p-4">
          {/* Avatar Skeleton */}
          <div className="size-10 shrink-0 rounded-2xl bg-slate-200" />

          {/* Info Skeleton */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-3.5 rounded bg-slate-200"
                style={{ width: `${60 + (i % 3) * 15}%` }}
              />
              <div className="h-2.5 w-10 shrink-0 rounded bg-slate-100" />
            </div>
            <div
              className="h-3 rounded bg-slate-100"
              style={{ width: `${75 - (i % 2) * 20}%` }}
            />
          </div>
        </div>
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}

/** Skeleton loading cho khung chat tin nhắn khi chọn một người */
export function ThreadSkeleton({ title }: { title?: string }) {
  return (
    <div
      role="status"
      aria-label="Đang tải cuộc trò chuyện"
      className="flex h-full min-h-0 min-w-0 flex-col bg-white animate-pulse"
    >
      {/* Header Skeleton */}
      <header className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 shrink-0 rounded-2xl bg-slate-200" />
          <div className="min-w-0 space-y-1.5">
            {title ? (
              <h2 className="truncate font-semibold text-slate-800 text-sm sm:text-base">{title}</h2>
            ) : (
              <div className="h-4 w-36 rounded bg-slate-200" />
            )}
            <div className="h-2.5 w-24 rounded bg-slate-100" />
          </div>
        </div>
      </header>

      {/* Messages Scroll Area Skeleton */}
      <div className="flex-1 space-y-4 overflow-hidden bg-slate-50/70 p-4 sm:p-6">
        {/* Incoming message 1 */}
        <div className="flex items-end gap-2.5 justify-start">
          <div className="size-7 shrink-0 rounded-xl bg-slate-200" />
          <div className="max-w-[75%] sm:max-w-[65%] space-y-1">
            <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200/80 p-3.5 shadow-2xs space-y-2">
              <div className="h-3.5 w-44 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-100" />
            </div>
            <div className="h-2.5 w-12 rounded bg-slate-200/60" />
          </div>
        </div>

        {/* Outgoing message 1 */}
        <div className="flex items-end gap-2.5 justify-end">
          <div className="max-w-[75%] sm:max-w-[65%] space-y-1 items-end flex flex-col">
            <div className="rounded-2xl rounded-br-xs bg-teal-100/70 p-3.5 shadow-2xs space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-teal-200/80" />
            </div>
            <div className="h-2.5 w-12 rounded bg-slate-200/60" />
          </div>
        </div>

        {/* Incoming message 2 */}
        <div className="flex items-end gap-2.5 justify-start">
          <div className="size-7 shrink-0 rounded-xl bg-slate-200" />
          <div className="max-w-[75%] sm:max-w-[65%] space-y-1">
            <div className="rounded-2xl rounded-bl-xs bg-white border border-slate-200/80 p-3.5 shadow-2xs space-y-2">
              <div className="h-3.5 w-60 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-100" />
              <div className="h-3 w-52 rounded bg-slate-100" />
            </div>
            <div className="h-2.5 w-12 rounded bg-slate-200/60" />
          </div>
        </div>

        {/* Outgoing message 2 */}
        <div className="flex items-end gap-2.5 justify-end">
          <div className="max-w-[75%] sm:max-w-[65%] space-y-1 items-end flex flex-col">
            <div className="rounded-2xl rounded-br-xs bg-teal-100/70 p-3.5 shadow-2xs space-y-2">
              <div className="h-3.5 w-48 rounded bg-teal-200/80" />
              <div className="h-3 w-32 rounded bg-teal-200/60" />
            </div>
            <div className="h-2.5 w-12 rounded bg-slate-200/60" />
          </div>
        </div>
      </div>

      {/* Input Footer Skeleton */}
      <div className="border-t border-slate-200/90 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <div className="h-12 min-w-0 flex-1 rounded-xl bg-slate-100" />
          <div className="size-11 shrink-0 rounded-xl bg-slate-200" />
        </div>
      </div>
      <span className="sr-only">Đang tải tin nhắn…</span>
    </div>
  );
}

/** Skeleton loading cho màn hình Trợ lý AI */
export function AiThreadSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang nạp Trợ lý AI"
      className="flex h-full min-h-0 min-w-0 flex-col bg-white animate-pulse"
    >
      <header className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 shrink-0 rounded-2xl bg-teal-200" />
          <div className="min-w-0 space-y-1.5">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-2.5 w-48 rounded bg-slate-100" />
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-hidden bg-slate-50/70 p-4 sm:p-6">
        <div className="mx-auto my-auto max-w-md py-12 text-center space-y-4">
          <div className="mx-auto size-16 rounded-3xl bg-teal-100" />
          <div className="h-4 w-64 mx-auto rounded bg-slate-200" />
          <div className="h-3 w-48 mx-auto rounded bg-slate-100" />
        </div>
      </div>

      <div className="border-t border-slate-200/90 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <div className="h-12 min-w-0 flex-1 rounded-xl bg-slate-100" />
          <div className="size-11 shrink-0 rounded-xl bg-slate-200" />
        </div>
      </div>
      <span className="sr-only">Đang nạp Trợ lý AI...</span>
    </div>
  );
}
