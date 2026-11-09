'use client';

import { useState } from 'react';
import { ModerationReviewListPage } from '@/features/moderation';
import { ReviewModerationQueue } from '@/features/moderation/components/ReviewModerationQueue';

export default function ModeratorReviewsRoute() {
  const [tab, setTab] = useState<'ALL' | 'REPORTED'>('ALL');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* 1. Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Kiểm duyệt đánh giá
        </h1>
      </div>

      {/* 2. Navigation Tabs right below Title */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={tab === 'ALL'}
            onClick={() => setTab('ALL')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'ALL'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Tất cả đánh giá</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === 'REPORTED'}
            onClick={() => setTab('REPORTED')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'REPORTED'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Đánh giá bị báo cáo</span>
          </button>
        </div>
      </div>

      {/* 3. Content */}
      {tab === 'REPORTED' ? (
        <ReviewModerationQueue hideTitle />
      ) : (
        <ModerationReviewListPage hideTitle />
      )}
    </div>
  );
}
