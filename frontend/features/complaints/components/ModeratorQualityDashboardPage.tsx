'use client';

import { useMemo, useState } from 'react';
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
import { AntSelect } from '@/components/ui';
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
  const [sortBy, setSortBy] = useState<'RATING' | 'COMPLAINTS' | 'RESOLUTION'>('RATING');

  const {
    data: escalatedData,
    isLoading: isLoadingEscalated,
    isError: isErrorEscalated,
    refetch: refetchEscalated,
    isFetching: isFetchingEscalated,
  } = useGetModeratorComplaintsQuery({ status: 'ESCALATED', limit: 20 });

  const {
    data: qualityData,
    isLoading: isLoadingQuality,
    isError: isErrorQuality,
    refetch: refetchQuality,
    isFetching: isFetchingQuality,
  } = useGetAgencyQualityDashboardQuery();

  const isFetching = isFetchingEscalated || isFetchingQuality;

  const handleRefreshAll = () => {
    void refetchEscalated();
    void refetchQuality();
  };

  // Overview stats calculation
  const overviewStats = useMemo(() => {
    const escalatedCount = escalatedData?.items?.length || 0;
    const totalAgencies = qualityData?.length || 0;
    const totalFeedbacks = qualityData?.reduce((acc, a) => acc + (a.totalFeedbacks || 0), 0) || 0;
    const totalComplaints = qualityData?.reduce((acc, a) => acc + (a.totalComplaints || 0), 0) || 0;

    let avgRatingScore = 0;
    if (totalFeedbacks > 0 && qualityData) {
      const sumWeighted = qualityData.reduce((acc, a) => acc + a.avgRating * a.totalFeedbacks, 0);
      avgRatingScore = Number((sumWeighted / totalFeedbacks).toFixed(1));
    }

    const avgResolutionRate =
      totalAgencies > 0 && qualityData
        ? Math.round(qualityData.reduce((acc, a) => acc + a.resolutionRatePercent, 0) / totalAgencies)
        : 100;

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
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 text-slate-500 ${isFetching ? 'animate-spin text-brand-teal' : ''}`} />
            <span>{isFetching ? 'Đang tải...' : 'Làm mới'}</span>
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
              {overviewStats.avgRatingScore > 0 ? `${overviewStats.avgRatingScore}/5` : '5.0/5'}
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
            <span className="text-2xl font-black text-slate-900">{overviewStats.avgResolutionRate}%</span>
            <span className="text-xs text-slate-400 font-medium">thành công</span>
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
        {activeTab === 'QUALITY' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm đối tác..."
                value={agencySearch}
                onChange={(e) => setAgencySearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
              />
              {agencySearch && (
                <button
                  type="button"
                  onClick={() => setAgencySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <AntSelect<'RATING' | 'RESOLUTION' | 'COMPLAINTS'>
              aria-label="Sắp xếp danh sách"
              value={sortBy}
              onChange={(val) => setSortBy(val)}
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
            <LoadingState label="Đang tải các vụ việc leo thang..." />
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
            <LoadingState label="Đang tải chỉ số đánh giá CSAT..." />
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
                    {agencies.map((item, index) => {
                      const isLowCsat = item.avgRating > 0 && item.avgRating < 3.5;
                      const hasHighEscalation = item.escalatedCount >= 2;
                      const initial = item.agencyName.slice(0, 2).toUpperCase();

                      return (
                        <tr key={item.agencyId} className="hover:bg-slate-50/60 transition-colors">
                          {/* Rank & Agency */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-600">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                              </span>
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal font-bold text-xs">
                                {initial}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900 text-sm">{item.agencyName}</h4>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ID: {item.agencyId.slice(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Đánh giá */}
                          <td className="px-5 py-4">
                            {item.totalFeedbacks > 0 ? (
                              <div>
                                <div className="flex items-center gap-1 font-semibold text-slate-800 text-sm">
                                  <Star className="size-3.5 text-amber-500 fill-amber-400 shrink-0" />
                                  <span>{item.avgRating.toFixed(1)}</span>
                                  <span className="text-xs text-slate-400 font-normal">/ 5</span>
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

                          {/* Resolution rate */}
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <span className="font-medium text-slate-800">{item.resolutionRatePercent}%</span>
                              <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-brand-teal transition-all"
                                  style={{ width: `${Math.min(100, Math.max(0, item.resolutionRatePercent))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            {isLowCsat || hasHighEscalation ? (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
