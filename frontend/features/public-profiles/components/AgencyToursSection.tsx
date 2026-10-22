'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Compass, MapPin, Clock3, Star, ArrowUpRight } from 'lucide-react';
import { useGetToursQuery } from '@/features/tours/api/toursApi';

interface AgencyToursSectionProps {
  agencyId: string;
  agencyName: string;
}

export function AgencyToursSection({ agencyId, agencyName }: AgencyToursSectionProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetToursQuery({ agencyId, page, limit: 6 });

  const tours = data?.items ?? [];
  const meta = data?.meta;

  return (
    <section aria-labelledby="agency-tours-heading" className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
              <Compass className="size-4" />
            </div>
            <h2 id="agency-tours-heading" className="text-xl sm:text-2xl font-bold text-slate-900">
              Các chuyến đi của {agencyName}
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Khám phá những trải nghiệm du lịch hấp dẫn do đơn vị trực tiếp tổ chức và vận hành.
          </p>
        </div>

        {meta && meta.total > 0 && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {meta.total} chuyến đi
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : tours.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 shadow-2xs mb-2.5">
            <Compass className="size-6" />
          </div>
          <p className="font-semibold text-slate-700 text-sm">Chưa có chuyến đi nào được đăng tải</p>
          <p className="text-xs text-slate-500 mt-1">
            Các chuyến đi mới của nhà cung cấp sẽ sớm được cập nhật tại đây.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tours.map((tour) => {
              const cover = tour.coverImage || '/placeholder-tour.jpg';
              return (
                <div
                  key={tour.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-md hover:border-teal-200 transition-all duration-200"
                >
                  <div>
                    {/* Image thumbnail */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt={tour.title}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white">
                        <MapPin className="size-3 text-teal-400" />
                        <span>{tour.destination}</span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-xs px-2 py-1 text-[11px] font-semibold text-white">
                        <Clock3 className="size-3 text-amber-400" />
                        <span>{tour.durationDays}N</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mb-1.5">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{tour.ratingAvg ? tour.ratingAvg.toFixed(1) : '5.0'}</span>
                        <span className="text-slate-400 font-normal">
                          ({tour.ratingCount ?? 0} đánh giá)
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-teal-700 transition-colors">
                        <Link href={`/tours/${tour.id}`} className="focus:outline-hidden">
                          {tour.title}
                        </Link>
                      </h3>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="p-4 pt-0 mt-auto border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">Giá từ</p>
                      <p className="text-base font-extrabold text-teal-800">
                        {tour.basePrice.toLocaleString('vi-VN')} ₫
                      </p>
                    </div>

                    <Link
                      href={`/tours/${tour.id}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition"
                    >
                      <span>Xem tour</span>
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav aria-label="Phân trang tour nhà cung cấp" className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Trang trước
              </button>
              <span className="text-xs text-slate-600 font-semibold">
                Trang {page} / {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Trang sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
