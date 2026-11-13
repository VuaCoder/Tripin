'use client';

import { useGetToursQuery } from '../../api/toursApi';
import { TourCard } from '../TourCard';

export interface SimilarToursSectionProps {
  currentTourId: string;
  destination?: string;
  categoryId?: string;
}

export function SimilarToursSection({ currentTourId, destination, categoryId }: SimilarToursSectionProps) {
  const { data, isLoading } = useGetToursQuery({
    destination: destination || undefined,
    categoryId: categoryId || undefined,
    limit: 8,
  });

  const similarTours = (data?.items || [])
    .filter((t) => t.id !== currentTourId)
    .slice(0, 4);

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
          <p className="mt-1 text-sm text-slate-500">
            Các hành trình tương tự khám phá {destination || 'Việt Nam'} được nhiều du khách quan tâm.
          </p>
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
