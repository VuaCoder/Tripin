'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Inbox,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Star,
  Ticket as TicketIcon,
  User,
  X,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { Pagination } from '@/components/ui';
import { useAppSelector } from '@/store/hooks';
import { selectUser } from '@/features/auth';
import { useGetAgencyComplaintsQuery } from '../api/complaintsApi';
import { COMPLAINT_TAXONOMY, getCategoryLabel, PRIORITY_LABELS, STATUS_LABELS } from '../labels';
import type { ComplaintTicketPriority, ComplaintTicketStatus } from '../types';
import { ComplaintConversationView } from './ComplaintConversationView';

const PAGE_SIZE = 10;
type StatusFilter = 'ALL' | ComplaintTicketStatus;
type PriorityFilter = 'ALL' | ComplaintTicketPriority;

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function AgencyComplaintsTicketPage() {
  const user = useAppSelector(selectUser);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  const { data, isLoading, isFetching, isError, refetch } = useGetAgencyComplaintsQuery({
    page,
    limit: PAGE_SIZE,
    ...(filter === 'ALL' ? {} : { status: filter }),
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const rawItems = data?.items ?? [];

  // Client-side additional filters (Priority & Category)
  const items = useMemo(() => {
    return rawItems.filter((ticket) => {
      if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && ticket.category !== categoryFilter) return false;
      return true;
    });
  }, [rawItems, priorityFilter, categoryFilter]);

  // Compute KPI statistics
  const stats = useMemo(() => {
    const total = data?.meta?.total ?? rawItems.length;
    const openCount = rawItems.filter((t) => t.status === 'OPEN').length;
    const inProgressCount = rawItems.filter(
      (t) => t.status === 'IN_PROGRESS' || t.status === 'RESOLVED',
    ).length;
    const escalatedCount = rawItems.filter((t) => t.status === 'ESCALATED').length;
    const closedCount = rawItems.filter((t) => t.status === 'CLOSED').length;

    const ratedTickets = rawItems.filter((t) => t.hasFeedback && typeof t.rating === 'number');
    const avgRating =
      ratedTickets.length > 0
        ? (ratedTickets.reduce((acc, t) => acc + (t.rating || 0), 0) / ratedTickets.length).toFixed(1)
        : null;

    return {
      total,
      openCount,
      inProgressCount,
      escalatedCount,
      closedCount,
      avgRating,
      ratedCount: ratedTickets.length,
    };
  }, [data?.meta?.total, rawItems]);

  const hasActiveFilters =
    filter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || search.trim() !== '';

  const handleResetFilters = () => {
    setFilter('ALL');
    setPriorityFilter('ALL');
    setCategoryFilter('ALL');
    setSearch('');
    setPage(1);
  };

  if (selectedTicketId) {
    return (
      <div className="mx-auto w-full max-w-5xl h-[calc(100dvh-2rem)] min-h-[550px] p-2 sm:p-4 flex flex-col min-h-0">
        <ComplaintConversationView
          ticketId={selectedTicketId}
          userRole="AGENCY"
          userId={user?.id || ''}
          onBack={() => {
            setSelectedTicketId(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header Banner - Polished executive look with Tripin teal theme */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-teal-50/20 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/70 bg-teal-50/80 px-3 py-0.5 text-xs font-bold text-teal-800">
              <LifeBuoy className="size-3.5 text-brand-teal" />
              <span>Đối tác Lữ hành • CSKH &amp; Giải quyết khiếu nại</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Khiếu nại &amp; Hỗ trợ dịch vụ tour
            </h1>
            <p className="text-sm text-slate-500">
              Tiếp nhận khiếu nại và trao đổi trực tiếp với du khách để giải quyết thỏa đáng.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            {/* Toggle show/hide stats */}
            <button
              type="button"
              onClick={() => setShowStats((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
              title="Ẩn / hiện phần báo cáo thống kê"
            >
              <BarChart2 className="size-3.5 text-slate-500" />
              <span>{showStats ? 'Ẩn thống kê' : 'Hiện thống kê'}</span>
            </button>

            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 text-slate-500 ${isFetching ? 'animate-spin text-brand-teal' : ''}`} />
              <span>{isFetching ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards - Clean, refined, bright white surfaces with subtle icons */}
        {showStats && (
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5 border-t border-slate-200/60">
            {/* Card 1: Tổng số phiếu */}
            <div
              onClick={() => {
                setFilter('ALL');
                setPage(1);
              }}
              className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Tổng khiếu nại</span>
                <div className="size-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Inbox className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                <span className="text-xs text-slate-400 font-medium">vụ việc</span>
              </div>
            </div>

            {/* Card 2: Chờ tiếp nhận */}
            <div
              onClick={() => {
                setFilter('OPEN');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                stats.openCount > 0
                  ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400 shadow-2xs'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className={`text-xs font-semibold ${stats.openCount > 0 ? 'text-amber-900' : 'text-slate-500'}`}>
                  Chờ tiếp nhận
                </span>
                <div
                  className={`size-7 rounded-lg flex items-center justify-center ${
                    stats.openCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <AlertCircle className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black ${stats.openCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                  {stats.openCount}
                </span>
                <span className={`text-xs font-medium ${stats.openCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                  {stats.openCount > 0 ? 'cần xử lý' : 'ổn định'}
                </span>
              </div>
            </div>

            {/* Card 3: Đang giải quyết */}
            <div
              onClick={() => {
                setFilter('IN_PROGRESS');
                setPage(1);
              }}
              className="cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Đang đối thoại</span>
                <div className="size-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Clock className="size-3.5" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {stats.inProgressCount + stats.escalatedCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">đang trao đổi</span>
              </div>
            </div>

            {/* Card 4: Điểm CSAT */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">Đánh giá CSAT</span>
                <div className="size-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Star className="size-3.5 fill-amber-400 text-amber-500" />
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {stats.avgRating ? `${stats.avgRating}/5` : '—'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {stats.ratedCount > 0 ? `(${stats.ratedCount} đánh giá)` : 'chưa có điểm'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation - Elevated brand teal active states with count badges */}
      <div className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-px border-b border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => {
            setFilter('ALL');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'ALL'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Tất cả</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              filter === 'ALL' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilter('OPEN');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'OPEN'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Chờ tiếp nhận</span>
          {stats.openCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold animate-pulse">
              {stats.openCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setFilter('IN_PROGRESS');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'IN_PROGRESS'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Đang xử lý</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilter('RESOLVED');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'RESOLVED'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Đã đề xuất</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilter('ESCALATED');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'ESCALATED'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Sàn phân xử</span>
          {stats.escalatedCount > 0 && (
            <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-bold">
              {stats.escalatedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setFilter('CLOSED');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
            filter === 'CLOSED'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Đã đóng</span>
        </button>
      </div>

      {/* Search and Secondary Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã phiếu (#CP-...), tiêu đề, khách hàng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Priority & Category Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Lọc theo mức độ ưu tiên"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-teal shadow-2xs cursor-pointer"
          >
            <option value="ALL">Mọi mức độ</option>
            <option value="URGENT">Khẩn cấp</option>
            <option value="HIGH">Ưu tiên cao</option>
            <option value="NORMAL">Bình thường</option>
          </select>

          <select
            aria-label="Lọc theo danh mục khiếu nại"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-teal shadow-2xs max-w-[190px] truncate cursor-pointer"
          >
            <option value="ALL">Tất cả danh mục</option>
            {COMPLAINT_TAXONOMY.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              title="Xóa tất cả bộ lọc"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState label="Đang tải danh sách khiếu nại..." />
      ) : isError ? (
        <ErrorState
          title="Không thể tải danh sách khiếu nại"
          message="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại."
          onAction={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-xs">
          <EmptyState
            title={hasActiveFilters ? 'Không tìm thấy khiếu nại phù hợp' : 'Chưa có khiếu nại nào'}
            description={
              hasActiveFilters
                ? 'Không có phiếu nào thỏa mãn điều kiện tìm kiếm hoặc bộ lọc hiện tại.'
                : 'Hiện tại đơn vị chưa ghi nhận khiếu nại nào từ du khách.'
            }
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw className="size-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
            <span>
              Hiển thị <strong className="text-slate-800">{items.length}</strong> phiếu khiếu nại
            </span>
            <span className="text-slate-400">Bấm vào phiếu để mở luồng hội thoại</span>
          </div>

          <div className="space-y-3">
            {items.map((ticket) => {
              const status = STATUS_LABELS[ticket.status];
              const isUrgent = ticket.priority === 'URGENT';
              const needsAction = ticket.status === 'OPEN';
              const isClosed = ticket.status === 'CLOSED';
              const isEscalated = ticket.status === 'ESCALATED';

              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
                >
                  {/* Top Row: Ticket Code, Status, Priority, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded">
                        {ticket.ticketCode}
                      </span>

                      {/* Status - Calm, neutral pills without blinding rainbow colors */}
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                          isClosed
                            ? 'bg-slate-100 text-slate-600'
                            : needsAction
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                              : isEscalated
                                ? 'bg-rose-50 text-rose-800 border border-rose-200/70'
                                : 'bg-teal-50 text-teal-800 border border-teal-200/70'
                        }`}
                      >
                        {status.label}
                      </span>

                      {/* Priority Tag with color coding */}
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

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>Cập nhật: {dateTime.format(new Date(ticket.lastMessageAt))}</span>
                    </div>
                  </div>

                  {/* Middle Row: Subject Title */}
                  <div className="mt-3">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-brand-teal transition-colors tracking-tight line-clamp-1">
                      {ticket.subject}
                    </h3>
                  </div>

                  {/* Context Info - Clean, elegant, neutral text without cyan or purple badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span>
                      Khách hàng: <strong className="font-medium text-slate-800">{ticket.travelerName || 'Du khách'}</strong>
                    </span>

                    <span className="text-slate-300">·</span>

                    <span className="truncate max-w-sm">
                      Tour: <span className="font-medium text-slate-700">{ticket.tourTitle || 'Chuyến đi'}</span>
                    </span>

                    <span className="text-slate-300">·</span>

                    <span className="text-slate-600">
                      {getCategoryLabel(ticket.category)}
                    </span>

                    {ticket.bookingCode && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-400">
                          #{ticket.bookingCode}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Bottom Row: CSAT, Message Count, and Call to action */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-3">
                      {/* Customer CSAT Rating - Simple star & text, no bright yellow box */}
                      {ticket.hasFeedback && typeof ticket.rating === 'number' && (
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Star className="size-3.5 fill-amber-400 text-amber-500" />
                          <span>{ticket.rating}/5</span>
                          <span className="text-slate-400 font-normal">đánh giá</span>
                        </div>
                      )}

                      {/* Message Count */}
                      <span className="text-slate-400 font-medium">
                        {ticket.messageCount} phản hồi
                      </span>
                    </div>

                    {/* Call to action */}
                    <div className="inline-flex items-center gap-1 font-semibold text-slate-600 group-hover:text-brand-teal transition-colors">
                      <span>Mở hội thoại xử lý</span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {Boolean(data?.meta && data.meta.totalPages > 1) && (
            <div className="pt-4 flex justify-center">
              <Pagination
                page={page}
                totalPages={data!.meta.totalPages}
                totalItems={data!.meta.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="khiếu nại"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
