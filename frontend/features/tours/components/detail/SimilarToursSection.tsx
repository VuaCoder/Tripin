'use client';

import { useGetToursQuery } from '../../api/toursApi';
import { TourCard } from '../TourCard';

export interface SimilarToursSectionProps {
  currentTourId: string;
  destination?: string;
  categoryId?: string;
}

export function SimilarToursSection({ currentTourId, destination, categoryId }: SimilarToursSectionProps) {
  const { data: destData, isLoading: isDestLoading } = useGetToursQuery({
    ...(destination ? { destination } : {}),
    limit: 12,
  });

  const destItems = (destData?.items || []).filter((t) => t.id !== currentTourId);
  const needFallback = !isDestLoading && destItems.length < 4;

  const { data: fallbackData, isLoading: isFallbackLoading } = useGetToursQuery(
    { limit: 8 },
    { skip: !needFallback }
  );

  const isLoading = isDestLoading || (needFallback && isFallbackLoading);

  // Prioritize tours that share the same category within the same destination
  const sortedDestItems = [...destItems].sort((a, b) => {
    if (!categoryId) return 0;
    const aHasCat = a.categoryIds?.includes(categoryId) ? 1 : 0;
    const bHasCat = b.categoryIds?.includes(categoryId) ? 1 : 0;
    return bHasCat - aHasCat;
  });

  const combined = [...sortedDestItems];
  if (combined.length < 4 && fallbackData?.items) {
    for (const item of fallbackData.items) {
      if (item.id !== currentTourId && !combined.some((existing) => existing.id === item.id)) {
        combined.push(item);
      }
      if (combined.length >= 4) break;
    }
  }

  const similarTours = combined.slice(0, 4);

  if (!isLoading && similarTours.length === 0) {
    return null;
  }

  return (
    <section className="mt-14 pt-10 border-t border-slate-200/80">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Có thể bạn sẽ thích
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {similarTours.map((t) => (
            <TourCard key={t.id} tour={t} />
          ))}
        </div>
      )}
    </section>
  );
}
