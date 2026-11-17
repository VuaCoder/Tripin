'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getTourApiMessage, useDeleteAgencyTourMutation, useGetAgencyTourQuery, useRestoreAgencyTourMutation, useSubmitAgencyTourMutation } from '../api/toursApi';
import { toursApi } from '../api/toursApi';
import { useAppDispatch } from '@/store/hooks';
import { AgencyDenied, useAgencyPermission } from '@/features/agency/AgencyCommon';
import { ArrowLeft, RotateCw, Edit3, Archive, Send, RefreshCw as RestoreIcon } from 'lucide-react';
import { agencyNotice } from '@/features/agency/agencyNotice';
import { AgencyPageTitle } from '@/features/agency/components/AgencyPageTitle';
import { Compass } from 'lucide-react';
import { Modal } from 'antd';
import { AgencyTourServicesSummary } from './AgencyTourServicesSummary';

const statusText: Record<string, string> = { DRAFT: 'Bản nháp', PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Cần chỉnh sửa', SUSPENDED: 'Tạm ẩn', ARCHIVED: 'Đã lưu trữ' };

export function AgencyTourWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requestedEdit = searchParams?.get('edit');
  const router = useRouter();
  const canView = useAgencyPermission('agency:tour-view');
  const canEditBasics = useAgencyPermission('tour:update-own');
  const canEditItinerary = useAgencyPermission('tour:configure-itinerary');
  const canManageLifecycle = useAgencyPermission('tour:delete-own');
  const canManageAvailability = useAgencyPermission('tour:set-availability');
  const dispatch = useAppDispatch();
  const { currentData: tour, isLoading, isFetching, error, refetch } = useGetAgencyTourQuery(id, { skip: !canView, pollingInterval: 30_000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  const [submitTour, submitState] = useSubmitAgencyTourMutation();
  const [deleteTour, deleteState] = useDeleteAgencyTourMutation();
  const [restoreTour, restoreState] = useRestoreAgencyTourMutation();
  const [errorText, setErrorText] = useState('');
  const completionDeparture = searchParams?.get('departureId');
  const completionTab = searchParams?.get('tab') === 'completion';
  useEffect(() => {
    if (completionTab && completionDeparture) router.replace(`/agency/completions?tourId=${encodeURIComponent(id)}&departureId=${encodeURIComponent(completionDeparture)}`);
  }, [completionTab, completionDeparture, id, router]);
  useEffect(() => {
    if (!tour || tour.status === 'ARCHIVED') return;
    if (requestedEdit === 'availability' && canManageAvailability) router.replace('/agency/calendar');
    if (requestedEdit === 'itinerary' && canEditItinerary && tour.status !== 'PENDING_REVIEW') router.replace(`/agency/tours/${id}/edit?section=itinerary`);
  }, [requestedEdit, canManageAvailability, canEditItinerary, tour, router, id]);

  const run = async (operation: () => Promise<unknown>, success: string, action = 'Lưu thay đổi') => {
    setErrorText('');
    try {
      await operation();
      agencyNotice.success(success, {
        description: `Tour: ${tour?.title || ''}`,
        inbox: true,
        type: 'TOUR_UPDATE',
      });
    } catch (e) {
      const msg = `${action} chưa hoàn thành: ${getTourApiMessage(e, 'Vui lòng thử lại.')}`;
      setErrorText(msg);
      agencyNotice.error(msg, {
        description: `Tour: ${tour?.title || ''}`,
        inbox: true,
        type: 'TOUR_ERROR',
      });
    }
  };
  const submit = () => {
    void run(() => submitTour(id).unwrap(), 'Tour đã được gửi để kiểm duyệt.', 'Gửi duyệt tour');
  };
  const remove = async () => {
    Modal.confirm({
      title: 'Tạm dừng / Lưu trữ tour',
      content: `Bạn có chắc chắn muốn lưu trữ tour “${tour?.title || ''}”? Tour sẽ tạm ngừng mở bán và chuyển vào danh sách lưu trữ.`,
      okText: 'Xác nhận lưu trữ',
      okType: 'danger',
      cancelText: 'Hủy bỏ',
      onOk: async () => {
        try {
          await deleteTour(id).unwrap();
          agencyNotice.success('Đã chuyển tour vào danh sách lưu trữ.', {
            description: `Tour: ${tour?.title || ''}`,
            inbox: true,
            type: 'TOUR_ARCHIVED',
          });
          window.location.assign('/agency/tours');
        } catch (e) {
          const err = getTourApiMessage(e, 'Không thể lưu trữ tour.');
          setErrorText(err);
          agencyNotice.error(err, { inbox: true, type: 'TOUR_ERROR' });
        }
      },
    });
  };
  const handleRestore = async () => {
    Modal.confirm({
      title: 'Khôi phục tour hoạt động',
      content: `Khôi phục tour “${tour?.title || ''}” về bản nháp để tiếp tục mở bán và chỉnh sửa?`,
      okText: 'Khôi phục ngay',
      cancelText: 'Hủy',
      onOk: async () => {
        setErrorText('');
        try {
          const restored = await restoreTour(id).unwrap();
          await dispatch(toursApi.util.upsertQueryData('getAgencyTour', id, restored));
          const msg = 'Đã khôi phục tour về bản nháp thành công!';
          agencyNotice.success(msg, {
            description: `Tour: ${tour?.title || ''}`,
            inbox: true,
            type: 'TOUR_RESTORED',
          });
        } catch (e) {
          const err = getTourApiMessage(e, 'Không thể khôi phục tour.');
          setErrorText(err);
          agencyNotice.error(err, { inbox: true, type: 'TOUR_ERROR' });
        }
      },
    });
  };

  if (!canView) return <AgencyDenied />;
  if (isLoading || (!tour && isFetching)) return <main className="mx-auto max-w-6xl p-6" role="status">Đang tải thông tin tour…</main>;
  if (error || !tour) return <main className="mx-auto max-w-6xl p-6"><p role="alert" className="text-red-700">{getTourApiMessage(error, 'Không tìm thấy tour hoặc bạn không có quyền truy cập.')}</p><button onClick={() => void refetch()} className="mt-3 rounded-lg border px-4 py-2">Thử tải lại</button></main>;

  const isArchived = tour.status === 'ARCHIVED';
  const isPendingReview = tour.status === 'PENDING_REVIEW';
  const locked = isPendingReview || isArchived;
  const busy = submitState.isLoading || deleteState.isLoading || restoreState.isLoading;
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between">
      <Link href="/agency/tours" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-primary-container hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden="true" />Danh sách tour</Link>
      <button 
        type="button" 
        disabled={isFetching} 
        onClick={() => void refetch()} 
        aria-label="Làm mới trạng thái"
        title="Làm mới trạng thái"
        className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
      >
        <RotateCw size={17} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />
      </button>
    </div>
    <header className="mb-7 mt-4 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <AgencyPageTitle icon={Compass}>{tour.title}</AgencyPageTitle>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusText[tour.status]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{tour.destination} · {tour.durationDays} ngày · {new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫</p>
        {tour.statusReason && <p className="mt-2 text-sm text-amber-800">Ghi chú kiểm duyệt: {tour.statusReason}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {isArchived ? (canManageLifecycle ? (
          <button
            type="button"
            onClick={() => void handleRestore()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RestoreIcon size={16} />
            <span>{restoreState.isLoading ? 'Đang khôi phục…' : 'Khôi phục tour'}</span>
          </button>
        ) : null) : (
          <>
            {canEditBasics && <Link
              href={`/agency/tours/${id}/edit?from=/agency/tours/${id}`}
              onClick={(event) => { if (locked) event.preventDefault(); }}
              aria-disabled={locked}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors shadow-2xs ${
                locked
                  ? 'pointer-events-none border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Edit3 size={15} />
              <span>Sửa nội dung tour</span>
            </Link>}

            {canManageLifecycle && ['DRAFT', 'REJECTED', 'SUSPENDED'].includes(tour.status) && (
              <button
                type="button"
                onClick={submit}
                disabled={busy || locked}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-teal-800 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <Send size={15} />
                <span>{submitState.isLoading ? 'Đang gửi…' : 'Gửi duyệt tour'}</span>
              </button>
            )}

            {canManageLifecycle && <button
              type="button"
              onClick={() => void remove()}
              disabled={busy || locked}
              title="Tạm dừng mở bán và lưu trữ tour"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Archive size={15} />
              <span>Lưu trữ tour</span>
            </button>}
          </>
        )}
      </div>
    </header>
    {tour.status === 'APPROVED' && <p className="mb-5 text-sm text-slate-600">Khi lưu thay đổi nội dung hoặc lịch trình, tour sẽ được gửi kiểm duyệt lại và tạm ẩn đến khi được duyệt.</p>}
    {isPendingReview && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Tour đang chờ xét duyệt. Thông tin và lịch trình tạm khóa chỉnh sửa. Lịch khởi hành được quản lý riêng trong Calendar.</p>}
    {searchParams?.get('review') === 'failed' && (tour.status === 'DRAFT' || tour.status === 'REJECTED') && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Nội dung tour đã được lưu nhưng chưa gửi duyệt thành công. Bấm “Gửi duyệt tour” để thử lại; không cần tạo tour mới.</p>}
    {isArchived && <p className="mb-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700 border border-slate-200">Tour này đã được lưu trữ (ngừng hoạt động). Bấm nút <strong>Khôi phục tour</strong> ở trên để chuyển về Bản nháp và tiếp tục chỉnh sửa.</p>}
    {errorText && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errorText}</p>}
    <div className="space-y-7">
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="tour-overview-title">
        <h2 id="tour-overview-title" className="text-lg font-bold text-slate-900">Thông tin tour</h2>
        {tour.images?.length > 0 && <div className="mt-4 flex gap-3 overflow-x-auto">{tour.images.map((src, index) => <img key={`${src}-${index}`} src={src} alt={`${tour.title} - ảnh ${index + 1}`} className="h-36 w-56 shrink-0 rounded-xl object-cover" />)}</div>}
        {tour.summary && <p className="mt-4 text-sm leading-6 text-slate-700">{tour.summary}</p>}
        {tour.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{tour.description}</p>}
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Giá cơ bản</dt><dd className="font-semibold text-slate-900">{new Intl.NumberFormat('vi-VN').format(tour.basePrice)} ₫</dd></div><div><dt className="text-slate-500">Thời lượng</dt><dd className="font-semibold text-slate-900">{tour.durationDays} ngày</dd></div></dl>
        {!!tour.categories?.length && <p className="mt-4 text-sm text-slate-700"><span className="font-semibold">Danh mục:</span> {tour.categories.map((category) => category.name).join(', ')}</p>}
        {tour.maxGroupSize && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Số khách tối đa:</span> {tour.maxGroupSize}</p>}
        {tour.guide && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Hướng dẫn viên:</span> {tour.guide.fullName}</p>}
        {!!tour.inclusions?.length && <div className="mt-5"><h3 className="font-semibold text-slate-900">Dịch vụ bao gồm</h3><ul className="mt-2 list-inside list-disc text-sm text-slate-700">{tour.inclusions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {!!tour.exclusions?.length && <div className="mt-5"><h3 className="font-semibold text-slate-900">Dịch vụ không bao gồm</h3><ul className="mt-2 list-inside list-disc text-sm text-slate-700">{tour.exclusions.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {!!tour.highlights?.length && <div className="mt-5"><h3 className="font-semibold text-slate-900">Điểm nổi bật</h3><ul className="mt-2 list-inside list-disc text-sm text-slate-700">{tour.highlights.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {tour.cancellationPolicy && <div className="mt-5"><h3 className="font-semibold text-slate-900">Chính sách hoàn hủy</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-700">{tour.cancellationPolicy}</p></div>}
        {tour.childPricingPolicy && <div className="mt-5"><h3 className="font-semibold text-slate-900">Chính sách giá trẻ em</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-700">{tour.childPricingPolicy}</p></div>}
        {tour.travelNotes && <div className="mt-5"><h3 className="font-semibold text-slate-900">Lưu ý chuyến đi</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-700">{tour.travelNotes}</p></div>}
        {tour.requiredDocuments && <div className="mt-5"><h3 className="font-semibold text-slate-900">Giấy tờ cần mang theo</h3><p className="mt-2 whitespace-pre-line text-sm text-slate-700">{tour.requiredDocuments}</p></div>}
        <AgencyTourServicesSummary services={tour.optionalServices} />
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" aria-labelledby="tour-itinerary-title"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="tour-itinerary-title" className="text-lg font-bold text-slate-900">Lịch trình tour</h2>{canEditItinerary && !locked && <Link href={`/agency/tours/${id}/edit?section=itinerary`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">Sửa lịch trình</Link>}</div>
        {locked && <p className="mt-2 text-sm text-amber-800">{isArchived ? 'Tour đã lưu trữ. Khôi phục tour để sửa lịch trình.' : 'Tour đang chờ duyệt nên chưa thể sửa lịch trình.'}</p>}
        {tour.itinerary.length === 0 ? <p className="mt-4 text-sm text-slate-600">Chưa có lịch trình.</p> : <ol className="mt-4 space-y-4">{[...tour.itinerary].sort((a, b) => a.day - b.day).map((day) => <li key={`${day.day}-${day.toDay ?? day.day}`} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Ngày {day.day}{day.toDay && day.toDay > day.day ? `–${day.toDay}` : ''}: {day.title}</h3>{day.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{day.description}</p>}{!!day.activities?.length && <ul className="mt-2 list-inside list-disc text-sm text-slate-700">{day.activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul>}</li>)}</ol>}
      </section>
    </div>
  </main>;
}
