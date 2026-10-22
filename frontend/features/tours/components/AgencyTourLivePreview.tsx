'use client';

import { useState } from 'react';
import { MapPin, Clock, Check } from 'lucide-react';
import { formatCategoryName } from '../utils';

interface Props {
  title: string;
  destination: string;
  durationDays: number;
  basePrice: number;
  images: string[];
  summary?: string;
  inclusions?: string[];
  categoryNames?: string[];
  guide?: { id: string; fullName: string; avatarUrl?: string };
}

export function AgencyTourLivePreview({
  title,
  destination,
  durationDays,
  basePrice,
  images,
  summary,
  inclusions = [],
  categoryNames = [],
  guide,
}: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const displayImages = images.length > 0 
    ? images 
    : ['https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80'];

  const currentImage = displayImages[activeImageIdx] || displayImages[0];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6">
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            Xem trước
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
          Giao diện khách hàng
        </span>
      </div>

      {/* Simulated Tour Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
        {/* Cover Image Carousel */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img
            src={currentImage}
            alt={title || 'Ảnh xem trước tour'}
            className="size-full object-cover transition-all duration-300"
          />

          {/* Badges on image */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm">
              <MapPin size={14} className="text-teal-600" aria-hidden="true" />
              <span>{destination.trim() || 'Việt Nam'}</span>
            </span>
          </div>

          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              <Clock size={14} aria-hidden="true" />
              <span>{durationDays || 1} ngày</span>
            </span>
          </div>

          {/* Image carousel controls if multiple images */}
          {displayImages.length > 1 && (
            <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5 z-10">
              {displayImages.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImageIdx(i)}
                  className={`size-2 rounded-full transition-all ${
                    activeImageIdx === i ? 'bg-white w-5 shadow-sm' : 'bg-white/60 hover:bg-white/90'
                  }`}
                  aria-label={`Ảnh ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5">
          {/* Rating & Categories */}
          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
            <div className="flex items-center gap-1 font-bold text-amber-500">
              <span className="text-slate-600 font-normal">Bản xem trước</span>
            </div>
            {categoryNames.length > 0 && (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 font-bold text-teal-700 truncate max-w-[140px]">
                {formatCategoryName(categoryNames[0])}
              </span>
            )}
          </div>

          {/* Tour Title */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2 leading-snug min-h-[2.8rem]">
            {title.trim() || 'Tên hành trình khám phá của bạn'}
          </h3>

          {/* Tour Summary */}
          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {summary?.trim() || 'Tóm tắt trải nghiệm hành trình với những điểm đến hấp dẫn và các hoạt động văn hoá độc bản.'}
          </p>

          {/* Key Inclusions preview */}
          {inclusions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {inclusions.slice(0, 3).map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  <Check size={13} className="text-teal-600" aria-hidden="true" />
                  <span className="truncate max-w-[130px]">{item}</span>
                </span>
              ))}
              {inclusions.length > 3 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  +{inclusions.length - 3} tiện ích
                </span>
              )}
            </div>
          )}

          {/* Guide Preview if assigned */}
          {guide && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50/60 p-2 border border-teal-100">
              <div className="flex size-7 items-center justify-center rounded-full bg-teal-600 text-white font-bold text-xs">
                {guide.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-teal-700">Hướng dẫn viên</span>
                <span className="block text-xs font-bold text-slate-800 truncate">{guide.fullName}</span>
              </div>
            </div>
          )}

          {/* Pricing & CTA */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-400">Giá trọn gói</span>
              <span className="text-lg sm:text-xl font-extrabold text-[#087e8b]">
                {new Intl.NumberFormat('vi-VN').format(basePrice || 0)} ₫
                <span className="text-xs font-normal text-slate-500"> / khách</span>
              </span>
            </div>

            <div className="rounded-xl bg-primary-container px-4 py-2 text-xs font-bold text-white shadow-sm opacity-90 cursor-default">
              Đặt tour
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
