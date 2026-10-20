'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useId } from 'react';
import { 
  useDeleteAgencyTourMutation, 
  useGetAgencyToursQuery, 
  useUpdateAgencyTourMutation,
  useUploadAgencyTourImageMutation,
  getTourApiMessage 
} from '../api/toursApi';
import type { TourDetail, TourStatus } from '../types';
import { Pagination, AntSelect } from '@/components/ui';

function TourGridImageCarousel({ tour, onManageImages }: { tour: TourDetail; onManageImages: () => void }) {
  const images = (tour.images && tour.images.length > 0) ? tour.images : (tour.coverImage ? [tour.coverImage] : []);
  const [activeIdx, setActiveIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-slate-200 text-center p-4">
        <span className="material-symbols-outlined text-4xl text-slate-400">landscape</span>
        <span className="mt-2 text-xs font-bold text-slate-600">Chưa có ảnh bìa</span>
        <button
          type="button"
          onClick={onManageImages}
          className="mt-2 rounded-lg bg-white px-3 py-1 text-xs font-bold text-teal-700 shadow-sm hover:bg-teal-50 cursor-pointer"
        >
          + Thêm ảnh ngay
        </button>
      </div>
    );
  }

  return (
    <div className="relative size-full group/carousel select-none">
      <img
        src={images[activeIdx] || images[0]}
        alt={tour.title}
        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Carousel Dots & Controls when there are 2 or more images */}
      {images.length > 1 && (
        <>
          {/* Subtle indicator dots */}
          <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
            {images.slice(0, 7).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIdx(idx);
                }}
                aria-label={`Ảnh ${idx + 1}`}
                className={`transition-all duration-200 rounded-full cursor-pointer ${
                  activeIdx === idx
                    ? 'w-5 h-1.5 bg-white shadow-xs'
                    : 'size-1.5 bg-white/60 hover:bg-white/90'
                }`}
              />
            ))}
          </div>

          {/* Left Arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
            }}
            aria-label="Ảnh trước"
            className="absolute left-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-900/40 text-white backdrop-blur-xs flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-900/70 cursor-pointer z-10"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
            }}
            aria-label="Ảnh tiếp theo"
            className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-slate-900/40 text-white backdrop-blur-xs flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-900/70 cursor-pointer z-10"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </>
      )}
    </div>
  );
}

const statuses: { value: TourStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Cần chỉnh sửa' },
  { value: 'SUSPENDED', label: 'Đang tạm ẩn' },
];

const statusConfig: Record<TourStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: 'Bản nháp', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  PENDING_REVIEW: { label: 'Chờ duyệt', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  APPROVED: { label: 'Đã duyệt', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REJECTED: { label: 'Cần chỉnh sửa', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  SUSPENDED: { label: 'Tạm ẩn', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  ARCHIVED: { label: 'Đã lưu trữ', bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
};

// Preset high quality photos for quick brand enhancement
const PRESET_PHOTOS = [
  { label: 'Hà Giang Mùa Hoa', url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80' },
  { label: 'Sapa Mây Ngàn', url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80' },
  { label: 'Vịnh Hạ Long', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { label: 'Tràng An Ninh Bình', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80' },
  { label: 'Phố Cổ Hội An', url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Côn Đảo / Biển Đảo', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' },
];

export function AgencyTourListPage() {
  const router = useRouter();
  const [status, setStatus] = useState<TourStatus | undefined>();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'box' | 'grid'>('box');
  const { data, isLoading, isFetching, error, refetch } = useGetAgencyToursQuery({ page, limit: 12, status });
  const [deleteTour, deleteState] = useDeleteAgencyTourMutation();
  const [updateTour, updateState] = useUpdateAgencyTourMutation();
  const [actionError, setActionError] = useState('');
  const [archivingTour, setArchivingTour] = useState<{ id: string; title: string } | null>(null);

  // Image Upload / Management modal state
  const [editingImageTour, setEditingImageTour] = useState<TourDetail | null>(null);
  const [currentTourImages, setCurrentTourImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showModalUrlInput, setShowModalUrlInput] = useState(false);
  const [isModalDragging, setIsModalDragging] = useState(false);
  const [imageSaveMessage, setImageSaveMessage] = useState('');
  const [modalImageError, setModalImageError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadTourImage, uploadState] = useUploadAgencyTourImageMutation();
  const imageUploadInputId = useId();

  const openImageManager = (tour: TourDetail) => {
    setEditingImageTour(tour);
    setCurrentTourImages(tour.images && tour.images.length > 0 ? [...tour.images] : (tour.coverImage ? [tour.coverImage] : []));
    setNewImageUrl('');
    setShowModalUrlInput(false);
    setIsModalDragging(false);
    setImageSaveMessage('');
    setModalImageError('');
    setIsUploadingImage(false);
    setActionError('');
  };

  const handleAddImageUrl = () => {
    setModalImageError('');
    if (!newImageUrl.trim()) return;
    try {
      new URL(newImageUrl.trim());
      setCurrentTourImages((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl('');
      setShowModalUrlInput(false);
    } catch {
      setModalImageError('Vui lòng nhập đường link URL hợp lệ (ví dụ: https://...)');
    }
  };

  const processImageFiles = async (files: FileList | File[]) => {
    setModalImageError('');
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!validFiles.length) {
      setModalImageError('Vui lòng chọn hoặc kéo thả định dạng ảnh (JPG, PNG, WebP).');
      return;
    }
    for (const file of validFiles) {
      if (file.size > 5 * 1024 * 1024) {
        setModalImageError(`Kích thước ảnh “${file.name}” vượt quá 5MB.`);
        return;
      }
    }
    setIsUploadingImage(true);
    try {
      for (const file of validFiles) {
        const res = await uploadTourImage(file).unwrap();
        if (res.url) {
          setCurrentTourImages((prev) => [...prev, res.url]);
        }
      }
    } catch (err) {
      setModalImageError(getTourApiMessage(err, 'Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImageFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsModalDragging(false);
    if (e.dataTransfer.files) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleSaveImages = async () => {
    if (!editingImageTour) return;
    setImageSaveMessage('');
    setActionError('');
    try {
      const validImages = currentTourImages.filter((img) => img.startsWith('http://') || img.startsWith('https://'));
      await updateTour({
        id: editingImageTour.id,
        body: { images: validImages }
      }).unwrap();
      setImageSaveMessage('Đã cập nhật ảnh thành công!');
      setTimeout(() => {
        setEditingImageTour(null);
        setImageSaveMessage('');
      }, 1000);
    } catch (err) {
      setActionError(getTourApiMessage(err, 'Không thể cập nhật ảnh tour.'));
    }
  };

  const handleConfirmArchive = async () => {
    if (!archivingTour) return;
    setActionError('');
    try { 
      await deleteTour(archivingTour.id).unwrap(); 
      setArchivingTour(null);
    } catch (e) { 
      setActionError(getTourApiMessage(e, 'Không thể lưu trữ tour.')); 
      setArchivingTour(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header bar */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Quản lý tour
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tạo hành trình, quản lý ngày khởi hành, bổ sung hình ảnh thương hiệu và theo dõi trạng thái kiểm duyệt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            href="/agency/tours/import" 
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-teal-50 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Nhập nhiều tour</span>
          </Link>
          <Link 
            href="/agency/tours/new" 
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary transition-colors shadow-md shadow-primary-container/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Tạo tour</span>
          </Link>
        </div>
      </div>

      {/* Control bar: Status filter + View Mode Toggle + Total count */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-3 sm:p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span className="text-slate-500">Lọc trạng thái:</span>
            <AntSelect
              value={status ?? ''}
              onChange={(val) => {
                setStatus((val || undefined) as TourStatus | undefined);
                setPage(1);
              }}
              options={statuses}
              className="w-48"
              size="middle"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {data && (
            <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {data.meta.total} tour
            </span>
          )}

          {/* View mode toggle: Box (List) vs Grid */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('box')}
              title="Dạng box"
              aria-label="Dạng box"
              className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                viewMode === 'box'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">view_agenda</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Dạng lưới"
              aria-label="Dạng lưới"
              className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">grid_view</span>
            </button>
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-semibold text-red-800">
          {actionError}
        </p>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4" role="status" aria-label="Đang tải danh sách tour">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : error ? (
        <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-rose-500 mb-2">error</span>
          <p className="font-bold text-slate-900">Không tải được danh sách tour</p>
          <p className="mt-1 text-sm text-slate-600">{getTourApiMessage(error)}</p>
          <button 
            onClick={() => void refetch()} 
            className="mt-4 rounded-xl bg-primary-container px-4 py-2 text-sm font-semibold text-white hover:bg-primary transition-colors"
          >
            Thử lại
          </button>
        </section>
      ) : !data?.items.length ? (
        <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-xs">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-primary-container mb-4">
            <span className="material-symbols-outlined text-3xl">tour</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {status ? 'Không có tour ở trạng thái này' : 'Chưa có tour nào'}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            Tạo tour đầu tiên hoặc nhập nhiều tour để bắt đầu quản lý lịch trình, hình ảnh và ngày khởi hành.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link 
              href="/agency/tours/new" 
              className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-bold text-white hover:bg-primary transition-colors shadow-sm"
            >
              + Tạo tour mới
            </Link>
            <Link 
              href="/agency/tours/import" 
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Nhập nhiều tour
            </Link>
          </div>
        </section>
      ) : (
        <div aria-busy={isFetching}>
          {/* ========================================================================= */}
          {/* VIEW MODE 1: BOX / LIST VIEW                                              */}
          {/* ========================================================================= */}
          {viewMode === 'box' && (
            <div className="space-y-4">
              {data.items.map((tour) => {
                const tourCover = tour.images?.[0] || tour.coverImage;
                const statusInfo = statusConfig[tour.status] || { label: tour.status, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

                return (
                  <article 
                    key={tour.id} 
                    onClick={() => router.push(`/agency/tours/${tour.id}`)}
                    className="group relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:border-teal-400 hover:shadow-md transition-all cursor-pointer"
                  >
                    {/* Left: Thumbnail image + Quick photo trigger */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative size-24 sm:size-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                        {tourCover ? (
                          <img 
                            src={tourCover} 
                            alt={tour.title} 
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105" 
                          />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 p-2 text-center">
                            <span className="material-symbols-outlined text-2xl text-slate-400">landscape</span>
                            <span className="mt-1 text-[11px] font-semibold text-slate-500">Chưa có ảnh</span>
                          </div>
                        )}
                        {/* Hover button to change/upload photo directly */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openImageManager(tour);
                          }}
                          title="Quản lý ảnh tour"
                          className="absolute inset-0 flex items-center justify-center bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                          <span>Đổi ảnh</span>
                        </button>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base sm:text-lg font-bold text-slate-900 group-hover:text-primary transition-colors" title={tour.title}>
                            <Link 
                              href={`/agency/tours/${tour.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline focus:outline-none"
                            >
                              {tour.title}
                            </Link>
                          </h2>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <span className="material-symbols-outlined text-[16px] text-teal-600">location_on</span>
                            {tour.destination}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                            {tour.durationDays} ngày
                          </span>
                          <span>•</span>
                          <span className="font-extrabold text-[#087e8b]">
                            {new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5">
                            <span className="material-symbols-outlined text-[14px]">event</span>
                            {tour.departures?.length ?? 0} ngày khởi hành
                          </span>
                          <span>Cập nhật: {new Date(tour.updatedAt).toLocaleDateString('vi-VN')}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openImageManager(tour);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 underline ml-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">image</span>
                            {tour.images?.length ? `${tour.images.length} ảnh` : '+ Thêm ảnh'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                      <Link 
                        href={`/agency/tours/${tour.id}`} 
                        title="Quản lý lịch trình, ngày khởi hành và chỗ ngồi"
                        aria-label="Quản lý lịch trình & chỗ ngồi"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[17px] text-teal-700">calendar_month</span>
                        <span className="hidden sm:inline">Lịch trình & Chỗ</span>
                      </Link>
                      <Link 
                        href={`/agency/tours/${tour.id}/edit?from=/agency/tours`} 
                        aria-disabled={tour.status === 'PENDING_REVIEW'} 
                        title="Chỉnh sửa thông tin tour"
                        aria-label="Chỉnh sửa thông tin tour"
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors shadow-2xs ${
                          tour.status === 'PENDING_REVIEW' 
                            ? 'pointer-events-none border-slate-200 text-slate-300' 
                            : 'border-teal-600/30 text-teal-700 bg-teal-50/60 hover:bg-teal-100/70 hover:border-teal-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                        <span className="hidden sm:inline">Sửa thông tin</span>
                      </Link>
                      <button 
                        type="button" 
                        disabled={deleteState.isLoading || tour.status === 'PENDING_REVIEW'} 
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchivingTour({ id: tour.id, title: tour.title });
                        }} 
                        title="Lưu trữ tour"
                        aria-label="Lưu trữ tour"
                        className="flex size-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">archive</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW MODE 2: GRID VIEW                                                    */}
          {/* ========================================================================= */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.items.map((tour) => {
                const statusInfo = statusConfig[tour.status] || { label: tour.status, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

                return (
                  <article 
                    key={tour.id} 
                    onClick={() => router.push(`/agency/tours/${tour.id}`)}
                    className="group flex flex-col rounded-3xl border border-slate-200/90 bg-white overflow-hidden shadow-xs hover:border-teal-400 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  >
                    {/* Card Cover Image with Carousel */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      <TourGridImageCarousel tour={tour} onManageImages={() => openImageManager(tour)} />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border backdrop-blur-md shadow-xs ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 pointer-events-none">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/70 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-xs">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {tour.durationDays} ngày
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-1 text-xs font-semibold text-teal-700 mb-1.5">
                        <span className="material-symbols-outlined text-[15px]">location_on</span>
                        <span>{tour.destination}</span>
                      </div>

                      <h2 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem]" title={tour.title}>
                        <Link 
                          href={`/agency/tours/${tour.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline focus:outline-none"
                        >
                          {tour.title}
                        </Link>
                      </h2>

                      <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-500">Giá cơ bản</span>
                        <span className="text-lg font-extrabold text-[#087e8b]">
                          {new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{tour.departures?.length ?? 0} ngày khởi hành</span>
                        <span>Cập nhật {new Date(tour.updatedAt).toLocaleDateString('vi-VN')}</span>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                        <Link 
                          href={`/agency/tours/${tour.id}`} 
                          title="Quản lý lịch trình, ngày khởi hành và chỗ ngồi"
                          aria-label="Quản lý lịch trình & chỗ ngồi"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px] text-teal-700">calendar_month</span>
                          <span>Lịch trình</span>
                        </Link>
                        <Link 
                          href={`/agency/tours/${tour.id}/edit?from=/agency/tours`} 
                          aria-disabled={tour.status === 'PENDING_REVIEW'} 
                          title="Chỉnh sửa thông tin tour"
                          aria-label="Chỉnh sửa thông tin tour"
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-bold transition-colors shadow-2xs ${
                            tour.status === 'PENDING_REVIEW' 
                              ? 'pointer-events-none border-slate-200 text-slate-300' 
                              : 'border-teal-600/30 text-teal-700 bg-teal-50/60 hover:bg-teal-100/70 hover:border-teal-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Sửa thông tin</span>
                        </Link>
                        <button 
                          type="button" 
                          disabled={deleteState.isLoading || tour.status === 'PENDING_REVIEW'} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchivingTour({ id: tour.id, title: tour.title });
                          }} 
                          title="Lưu trữ tour"
                          aria-label="Lưu trữ tour"
                          className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[17px]">archive</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            totalItems={data.meta.total}
            pageSize={12}
            itemLabel="tour"
            onPageChange={setPage}
            disabled={isFetching}
            showInfo={false}
            className="mt-8 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK TOUR IMAGE UPLOAD & MANAGEMENT MODAL                                 */}
      {/* ========================================================================= */}
      {editingImageTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 relative my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-600">
                  Quản lý hình ảnh thương hiệu
                </span>
                <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
                  {editingImageTour.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingImageTour(null)}
                className="flex size-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-5 space-y-6">
              {/* Existing Images Gallery */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  Danh sách ảnh tour ({currentTourImages.length})
                </label>
                {currentTourImages.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-slate-500 text-sm">
                    Tour này chưa có hình ảnh nào. Hãy thêm ảnh bên dưới để tour hiển thị nổi bật và thu hút khách du lịch.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                    {currentTourImages.map((img, idx) => (
                      <div key={idx} className="group/item relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={img} alt={`Tour ${idx + 1}`} className="size-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 rounded-md bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                            Ảnh bìa
                          </span>
                        )}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...currentTourImages];
                                const [target] = next.splice(idx, 1);
                                next.unshift(target);
                                setCurrentTourImages(next);
                              }}
                              title="Đặt làm ảnh bìa"
                              className="rounded-lg bg-white/90 p-1.5 text-xs font-bold text-slate-800 hover:bg-white"
                            >
                              <span className="material-symbols-outlined text-[16px]">star</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCurrentTourImages(currentTourImages.filter((_, i) => i !== idx))}
                            title="Xóa ảnh"
                            className="rounded-lg bg-rose-600 p-1.5 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload image: Drag & drop / upload from computer + expandable URL */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Thêm ảnh mới
                </span>

                {/* Dropzone & PC upload */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsModalDragging(true); }}
                  onDragLeave={() => setIsModalDragging(false)}
                  onDrop={handleModalDrop}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                    isModalDragging 
                      ? 'border-teal-600 bg-teal-50/70' 
                      : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-slate-50'
                  }`}
                >
                  {isUploadingImage ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="size-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700 mb-2" />
                      <p className="text-xs font-bold text-teal-800">Đang tải ảnh lên Cloudinary...</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Vui lòng chờ trong giây lát</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-100/70 text-teal-700 mb-2">
                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        Kéo & thả ảnh vào đây, hoặc
                      </p>
                      <label
                        htmlFor={imageUploadInputId}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                        <span>Tải ảnh từ máy tính</span>
                      </label>
                      <input 
                        id={imageUploadInputId}
                        type="file" 
                        accept="image/png,image/jpeg,image/webp" 
                        multiple
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                      <p className="mt-2 text-[11px] text-slate-400">
                        Hỗ trợ định dạng JPG, PNG, WebP (Tối đa 5MB)
                      </p>
                    </>
                  )}
                </div>

                {modalImageError && (
                  <p role="alert" className="text-xs font-bold text-rose-600">
                    {modalImageError}
                  </p>
                )}

                {/* Thêm ảnh qua đường link ảnh */}
                <div className="pt-1">
                  {!showModalUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowModalUrlInput(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">link</span>
                      <span>+ Thêm ảnh qua đường link ảnh</span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-900 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">link</span>
                          Dán đường link ảnh
                        </span>
                        <button
                          type="button"
                          onClick={() => { setShowModalUrlInput(false); setNewImageUrl(''); }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Đóng
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                          placeholder="Dán đường link ảnh (https://...)"
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600"
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shrink-0"
                        >
                          + Thêm URL
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Preset Photos Suggestions */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Gợi ý ảnh đẹp theo điểm đến phổ biến:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRESET_PHOTOS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setCurrentTourImages((prev) => [...prev, preset.url])}
                      className="group/p relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-teal-500 transition-all text-left"
                    >
                      <img src={preset.url} alt={preset.label} className="size-full object-cover group-hover/p:scale-110 transition-transform duration-300" />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 p-1">
                        <span className="block text-[10px] font-bold text-white truncate text-center">
                          {preset.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {imageSaveMessage && (
                <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-sm font-bold text-emerald-800">
                  {imageSaveMessage}
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-7 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingImageTour(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={updateState.isLoading || isUploadingImage}
                onClick={() => void handleSaveImages()}
                className="rounded-xl bg-primary-container px-6 py-2.5 text-sm font-bold text-white hover:bg-primary transition-colors disabled:opacity-50 shadow-md shadow-primary-container/20 cursor-pointer"
              >
                {updateState.isLoading ? 'Đang lưu ảnh...' : isUploadingImage ? 'Đang tải ảnh...' : 'Lưu ảnh tour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ARCHIVE CONFIRMATION MODAL                                                */}
      {/* ========================================================================= */}
      {archivingTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shrink-0">
                <span className="material-symbols-outlined text-2xl">archive</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">
                  Bạn có muốn lưu trữ?
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  Tour: <span className="font-semibold text-slate-700">{archivingTour.title}</span>
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Tour này sẽ được chuyển vào danh sách lưu trữ và không còn hiển thị cho du khách đặt mới.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              {/* Nút Huỷ: Chữ trắng nền xanh (để người dùng không bị click lộn khi đã bấm lộn lưu trữ rồi) */}
              <button
                type="button"
                onClick={() => setArchivingTour(null)}
                disabled={deleteState.isLoading}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
              >
                Huỷ
              </button>

              {/* Nút Tiếp tục: Chữ xanh viền trắng */}
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={deleteState.isLoading}
                className="rounded-xl border border-teal-600 bg-white px-5 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
              >
                {deleteState.isLoading ? 'Đang lưu trữ...' : 'Tiếp tục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
