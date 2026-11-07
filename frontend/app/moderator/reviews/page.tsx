'use client';

import { ModerationReviewListPage } from '@/features/moderation';
import { ReviewModerationQueue } from '@/features/moderation/components/ReviewModerationQueue';
import { useState } from 'react';

export default function ModeratorReviewsRoute() {
  const [reported, setReported] = useState(true);
  return <div className="space-y-5"><nav className="flex gap-4"><button aria-pressed={reported} onClick={() => setReported(true)}>Review bị báo cáo</button><button aria-pressed={!reported} onClick={() => setReported(false)}>Tất cả đánh giá</button></nav>{reported ? <ReviewModerationQueue /> : <ModerationReviewListPage />}</div>;
}
