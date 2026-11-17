'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  User,
  X,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { AntSelect, Pagination } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useGetAgencyQualityDashboardQuery, useGetModeratorComplaintsQuery } from '../api/complaintsApi';
import { getCategoryLabel } from '../labels';
import { ComplaintConversationView } from './ComplaintConversationView';

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function ModeratorQualityDashboardPage() {
  const user = useAppSelector(selectUser);
  const [activeTab, setActiveTab] = useState<'ESCALATED' | 'QUALITY'>('ESCALATED');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [agencySearch, setAgencySearch] = useState('');
  const [isAgencySearchExpanded, setIsAgencySearchExpanded] = useState(false);
  const agencySearchRef = useRef<HTMLInputElement>(null);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [sortBy, setSortBy] = useState<'RATING' | 'COMPLAINTS' | 'RESOLUTION'>('RATING');
  const [agencyPage, setAgencyPage] = useState(1);

  const {
    data: escalatedData,
    isLoading: isLoadingEscalated,
    isError: isErrorEscalated,
    refetch: refetchEscalated,
    isFetching: isFetchingEscalated,
  } = useGetModeratorComplaintsQuery({ status: 'ESCALATED', limit: 20, ...(complaintSearch.trim() ? { search: complaintSearch.trim() } : {}) }, { refetchOnMountOrArgChange: 60 });

  const {
    data: qualityData,
    isLoading: isLoadingQuality,
    isError: isErrorQuality,
    refetch: refetchQuality,
    isFetching: isFetchingQuality,
  } = useGetAgencyQualityDashboardQuery(undefined, { refetchOnMountOrArgChange: 60 });

  const isFetching = isFetchingEscalated || isFetchingQuality;

  const handleRefreshAll = () => {
    void refetchEscalated();
    void refetchQuality();
  };

  // Overview stats calculation
  const overviewStats = useMemo(() => {
    const escalatedCount = escalatedData?.meta?.total || 0;
    const totalAgencies = qualityData?.length || 0;
    const totalFeedbacks = qualityData?.reduce((acc, a) => acc + (a.totalFeedbacks || 0), 0) || 0;
    const totalComplaints = qualityData?.reduce((acc, a) => acc + (a.totalComplaints || 0), 0) || 0;

    let avgRatingScore = 0;
    if (totalFeedbacks > 0 && qualityData) {
      const sumWeighted = qualityData.reduce((acc, a) => acc + a.avgRating * a.totalFeedbacks, 0);
      avgRatingScore = Number((sumWeighted / totalFeedbacks).toFixed(1));
    }

    const avgResolutionRate = totalComplaints > 0 && qualityData
      ? Math.round(qualityData.reduce((acc, a) => acc + a.resolutionRatePercent * a.totalComplaints, 0) / totalComplaints)
      : 0;

    return {
      escalatedCount,
      totalAgencies,
      totalComplaints,
      totalFeedbacks,
      avgRatingScore,
      avgResolutionRate,
    };
  }, [escalatedData?.items?.length, qualityData]);

  // Filtered and sorted agency list
  const agencies = useMemo(() => {
    if (!qualityData) return [];
    let list = qualityData.filter((a) =>
      a.agencyName.toLowerCase().includes(agencySearch.trim().toLowerCase()),
    );

    list = [...list].sort((a, b) => {
      if (sortBy === 'RATING') {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return b.totalFeedbacks - a.totalFeedbacks;
      }
      if (sortBy === 'COMPLAINTS') {
        return b.totalComplaints - a.totalComplaints;
      }
      if (sortBy === 'RESOLUTION') {
        return b.resolutionRatePercent - a.resolutionRatePercent;
      }
      return 0;
    });

    return list;
  }, [qualityData, agencySearch, sortBy]);

  if (selectedTicketId) {
    return (
      <div className="mx-auto w-full max-w-6xl h-[calc(100dvh-5rem)] min-h-[550px] p-2 sm:p-4 flex flex-col min-h-0">
        <ComplaintConversationView
          ticketId={selectedTicketId}
          userRole="MODERATOR"
          userId={user?.id || ''}
          onBack={() => {
            setSelectedTicketId(null);
            void refetchEscalated();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header Toolbar - Traveler Profile Style: prominent bold title, zero subtitles */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Giám sát tranh chấp tour
        </h1>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            disabled={isFetching}
            onClick={handleRefreshAll}
            aria-label="Làm mới"
            title="Làm mới"
            className="flex size-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin text-brand-teal' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Metric Cards - Clear, simple, human-friendly terms */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Tranh chấp cần can thiệp */}
        <div
          onClick={() => setActiveTab('ESCALATED')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-2xs hover:shadow-xs ${
            overviewStats.escalatedCount > 0
              ? 'border-rose-300 bg-rose-50/50 hover:border-rose-400'
              : 'border-slate-200/90 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className={`text-xs font-semibold ${overviewStats.escalatedCount > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
              Cần Sàn xử lý
            </span>
            <div
              className={`size-7 rounded-lg flex items-center justify-center ${
                overviewStats.escalatedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <ShieldAlert className="size-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${overviewStats.escalatedCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {overviewStats.escalatedCount}
            </span>
            <span className={`text-xs font-medium ${overviewStats.escalatedCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
              {overviewStats.escalatedCount > 0 ? 'vụ bế tắc' : 'ổn định'}
            </span>
          </div>
        </div>

        {/* Card 2: Đối tác hoạt động */}
        <div
          onClick={() => setActiveTab('QUALITY')}
          className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Đối tác theo dõi</span>
            <div className="size-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{overviewStats.totalAgencies}</span>
            <span className="text-xs text-slate-400 font-medium">đối tác</span>
          </div>
        </div>

        {/* Card 3: Đánh giá hài lòng */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Đánh giá trung bình</span>
            <div className="size-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {overviewStats.avgRatingScore > 0 ? `${overviewStats.avgRatingScore}/5` : '—'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {overviewStats.totalFeedbacks > 0 ? `(${overviewStats.totalFeedbacks} đánh giá)` : ''}
            </span>
          </div>
        </div>

        {/* Card 4: Tự hòa giải */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tự hòa giải</span>
            <div className="size-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{overviewStats.totalComplaints > 0 ? `${overviewStats.avgResolutionRate}%` : '—'}</span>
            {overviewStats.totalComplaints > 0 && <span className="text-xs text-slate-400 font-medium">thành công</span>}
          </div>
        </div>
      </div>

      {/* Tabs Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-1">
        <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('ESCALATED')}
            className={`flex items-center gap-2 px-3.5 py-2 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === 'ESCALATED'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Khiếu nại cần Sàn xử lý</span>
            {overviewStats.escalatedCount > 0 ? (
              <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 px-2 py-0.5 text-xs font-bold animate-pulse">
                {overviewStats.escalatedCount}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-bold">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('QUALITY')}
            className={`flex items-center gap-2 px-3.5 py-2 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === 'QUALITY'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Đánh giá chất lượng đối tác</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'QUALITY' ? 'bg-teal-50 text-teal-800 border border-teal-200/60' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {overviewStats.totalAgencies}
            </span>
          </button>
        </div>

        {/* Tab Filter Controls */}
        {activeTab === 'ESCALATED' && (
          <label className="relative block w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input type="search" aria-label="Tìm khiếu nại" placeholder="Tìm khiếu nại..." value={complaintSearch} onChange={(event) => setComplaintSearch(event.target.value)} className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15" />
          </label>
        )}
        {activeTab === 'QUALITY' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className={`relative h-10 transition-all duration-300 ${isAgencySearchExpanded || agencySearch ? 'w-56 sm:w-72' : 'w-10'}`}>
              {(isAgencySearchExpanded || agencySearch) && <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />}
              <input
                ref={agencySearchRef}
                type="text"
                aria-label="Tìm đối tác"
                placeholder="Tìm đối tác..."
                value={agencySearch}
                onFocus={() => setIsAgencySearchExpanded(true)}
                onKeyDown={(event) => { if (event.key === 'Escape') { setAgencySearch(''); setIsAgencySearchExpanded(false); agencySearchRef.current?.blur(); } }}
                onChange={(e) => { setAgencySearch(e.target.value); setAgencyPage(1); }}
                className={`h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 ${isAgencySearchExpanded || agencySearch ? '' : 'pointer-events-none opacity-0'}`}
              />
              {isAgencySearchExpanded || agencySearch ? (
                <button
                  type="button"
                  aria-label="Đóng tìm kiếm"
                  onClick={() => { setAgencySearch(''); setIsAgencySearchExpanded(false); setAgencyPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <button type="button" aria-label="Tìm đối tác" onClick={() => { setIsAgencySearchExpanded(true); setTimeout(() => agencySearchRef.current?.focus(), 50); }} className="absolute inset-0 flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50"><Search className="size-4" /></button>
              )}
            </div>

            <AntSelect<'RATING' | 'RESOLUTION' | 'COMPLAINTS'>
              aria-label="Sắp xếp danh sách"
              value={sortBy}
              onChange={(val) => { setSortBy(val); setAgencyPage(1); }}
              options={[
                { value: 'RATING', label: 'Điểm đánh giá' },
                { value: 'RESOLUTION', label: 'Tỷ lệ tự hòa giải' },
                { value: 'COMPLAINTS', label: 'Tổng khiếu nại' },
              ]}
              size="small"
              className="w-36 font-semibold"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Vụ việc leo thang (ESCALATED) */}
      {activeTab === 'ESCALATED' && (
        <div>
          {isLoadingEscalated ? (
            <div className="space-y-3 animate-pulse" role="status" aria-label="Đang tải danh sách khiếu nại">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-100" />
                  </div>
                  <div className="h-5 w-3/5 rounded bg-slate-200" />
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-3 w-24 rounded bg-slate-100" />
                    <div className="h-3 w-32 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : isErrorEscalated ? (
            <ErrorState
              title="Không thể tải dữ liệu"
              message="Đã có lỗi xảy ra. Vui lòng thử lại."
              onAction={() => void refetchEscalated()}
            />
          ) : !escalatedData?.items || escalatedData.items.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
              <div className="mx-auto size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không có vụ việc leo thang nào</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Hiện tại không có khiếu nại bế tắc nào cần Sàn can thiệp. Các bên đang tự trao đổi và hòa giải ổn thỏa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(escalatedData?.items ?? []).map((ticket) => {
                const isUrgent = ticket.priority === 'URGENT';

                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs cursor-pointer"
                  >
                    {/* Header row: Ticket Code, Sàn phân xử badge, urgent badge, timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded">
                          {ticket.ticketCode}
                        </span>
                        <span className="rounded bg-rose-50 text-rose-800 border border-rose-200/70 px-2 py-0.5 text-xs font-medium">
                          Cần phân xử
                        </span>
                        {/* Priority Badge */}
                        {ticket.priority === 'URGENT' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Khẩn cấp</span>
                          </span>
                        ) : ticket.priority === 'HIGH' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            <span>Ưu tiên cao</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                            <span className="size-1.5 rounded-full bg-slate-400" />
                            <span>Bình thường</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        Cập nhật {dateTime.format(new Date(ticket.lastMessageAt))}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="mt-2.5">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-teal transition-colors line-clamp-1">
                        {ticket.subject}
                      </h3>
                    </div>

                    {/* Clean metadata line with subtle icons */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <User className="size-3 text-slate-400" />
                        <span>{ticket.travelerName}</span>
                      </span>
                      <span className="text-slate-300 font-light">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Building2 className="size-3 text-slate-400" />
                        <span>{ticket.agencyName}</span>
                      </span>
                      <span className="text-slate-300 font-light">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600 truncate max-w-xs">
                        <Compass className="size-3 text-slate-400 shrink-0" />
                        <span className="truncate">{ticket.tourTitle}</span>
                      </span>
                    </div>

                    {/* Footer: Category & Phán quyết action */}
                    <div className="mt-3.5 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-medium">
                        {getCategoryLabel(ticket.category)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600 group-hover:text-brand-teal transition-colors">
                        <span>Thẩm định &amp; Phán quyết</span>
                        <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Bảng xếp hạng CSAT (QUALITY) - Clean, bright, clear table */}
      {activeTab === 'QUALITY' && (
        <div>
          {isLoadingQuality ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4 animate-pulse" role="status" aria-label="Đang tải chỉ số đánh giá CSAT">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="space-y-3 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-slate-200" />
                      <div className="space-y-1.5">
                        <div className="h-4 w-36 rounded bg-slate-200" />
                        <div className="h-3 w-20 rounded bg-slate-100" />
                      </div>
                    </div>
                    <div className="h-4 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-20 rounded bg-slate-100" />
                    <div className="h-2 w-24 rounded bg-slate-200" />
                    <div className="h-6 w-24 rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          ) : isErrorQuality ? (
            <ErrorState
              title="Không thể tải thống kê chất lượng"
              message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
              onAction={() => void refetchQuality()}
            />
          ) : agencies.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
              <EmptyState
                title={agencySearch ? 'Không tìm thấy đối tác lữ hành' : 'Chưa có dữ liệu đánh giá'}
                description={
                  agencySearch
                    ? `Không tìm thấy đơn vị lữ hành nào khớp với từ khóa "${agencySearch}".`
                    : 'Sau khi các phiếu khiếu nại được hoàn tất và du khách gửi khảo sát, bảng xếp hạng chỉ số sẽ hiển thị tại đây.'
                }
              />
              {agencySearch && (
                <button
                  type="button"
                  onClick={() => setAgencySearch('')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Xóa tìm kiếm</span>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Đối tác lữ hành</th>
                      <th className="px-5 py-3.5">Đánh giá hài lòng</th>
                      <th className="px-5 py-3.5">Tổng khiếu nại</th>
                      <th className="px-5 py-3.5">Tự hòa giải</th>
                      <th className="px-5 py-3.5">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {agencies.slice((agencyPage - 1) * 5, agencyPage * 5).map((item) => {
                      const isLowCsat = item.avgRating > 0 && item.avgRating < 3.5;
                      const hasHighEscalation = item.escalatedCount >= 2;
                      const initial = item.agencyName.slice(0, 2).toUpperCase();

                      return (
                        <tr key={item.agencyId} className="hover:bg-slate-50/60 transition-colors">
                          {/* Rank & Agency */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="size-9 shrink-0 rounded-xl object-cover" /> : <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal font-bold text-xs">{initial}</div>}
                              <div>
                                <h4 className="font-semibold text-slate-900 text-sm">{item.agencyName}</h4>
                              </div>
                            </div>
                          </td>

                          {/* Đánh giá */}
                          <td className="px-5 py-4">
                            {item.totalFeedbacks > 0 ? (
                              <div>
                                <div className="font-bold text-slate-900 text-sm">
                                  <span>{item.avgRating.toFixed(1)}</span>
                                  <span className="text-xs text-slate-400 font-normal"> / 5</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {item.totalFeedbacks} đánh giá
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Chưa có đánh giá</span>
                            )}
                          </td>

                          {/* Complaints */}
                          <td className="px-5 py-4">
                            <span className="font-medium text-slate-800">{item.totalComplaints} vụ việc</span>
                            {item.escalatedCount > 0 ? (
                              <div className="text-[11px] text-rose-600 font-medium">
                                {item.escalatedCount} cần sàn xử lý
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">
                                0 cần sàn xử lý
                              </div>
                            )}
                          </td>

                          {/* Resolution rate - Progress bar with hover title */}
                          <td className="px-5 py-4">
                            <div
                              className="group inline-block cursor-help py-1"
                              title={`Tỷ lệ tự hòa giải thành công: ${item.resolutionRatePercent}%`}
                            >
                              <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden relative">
                                <div
                                  className="h-full rounded-full bg-brand-teal transition-all group-hover:brightness-95"
                                  style={{ width: `${Math.min(100, Math.max(0, item.resolutionRatePercent))}%` }}
                                />
                              </div>
                              <span className="sr-only">{item.resolutionRatePercent}%</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            {item.totalComplaints === 0 && item.totalFeedbacks === 0 ? <span className="text-slate-500">Chưa có dữ liệu</span> : isLowCsat || hasHighEscalation ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                                <AlertTriangle className="size-3 text-amber-600" />
                                <span>Cần lưu ý</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                <span>Đạt chuẩn uy tín</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={agencyPage} totalPages={Math.ceil(agencies.length / 5)} totalItems={agencies.length} pageSize={5} onPageChange={setAgencyPage} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
