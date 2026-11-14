'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  Eye,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import { baseApi } from '@/store/api/baseApi';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import { FormSelect } from '@/components/ui/FormSelect';
import { EmptyState } from '@/components/shared';
import { formatSmartDateTime } from '@/lib/travel-format';
import { AdminFrame, Feedback, adminError, control, panel, toolbar, useAdminSession } from './AdminUi';
import { AdminAuditSkeleton } from './AdminSkeletons';

export type Audit = {
  id: string;
  action: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

const api = baseApi.injectEndpoints({
  endpoints: (build) => ({
    auditList: build.query<
      { items: Audit[]; meta: { totalPages: number; total?: number } },
      { page: number; from?: string; to?: string; targetType?: string; action?: string; order?: 'asc' | 'desc' }
    >({
      query: (params) => ({ url: '/admin/audit-logs', params: { ...params, limit: 15 } }),
      transformResponse: (r: { data: Audit[]; meta: { totalPages: number; total?: number } }) => ({
        items: r.data,
        meta: r.meta,
      }),
    }),
    exportAudit: build.mutation<string, { resource: 'audit-logs' | 'moderation'; from?: string; to?: string }>({
      query: ({ resource, ...params }) => ({
        url: `/admin/export/${resource}`,
        params,
        responseHandler: (r) => r.text(),
      }),
    }),
  }),
});

/* =========================================================================
   Vietnamese Human-Friendly Dictionaries
   ========================================================================= */

interface ActionConfig {
  label: string;
  badgeClass: string;
}

const ACTION_MAP: Record<string, ActionConfig> = {
  'review.moderated': {
    label: 'Kiểm duyệt đánh giá',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
  'agency.created': {
    label: 'Tạo công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.application_saved': {
    label: 'Lưu hồ sơ công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.join_code_changed': {
    label: 'Đổi mã gia nhập công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.join_request_changed': {
    label: 'Xử lý yêu cầu gia nhập công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.role_saved': {
    label: 'Cập nhật vai trò công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.tour_scope_changed': {
    label: 'Cập nhật phạm vi tour công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.tour_content_changed': {
    label: 'Cập nhật nội dung tour công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.member_access_changed': {
    label: 'Cập nhật quyền nhân sự',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.invitation_revoked': {
    label: 'Thu hồi lời mời công ty',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  'guide_payout.transferred': {
    label: 'Chuyển tiền thanh toán HDV',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  'report.resolved': {
    label: 'Xử lý báo cáo',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  'tour.validated': {
    label: 'Duyệt xuất bản tour',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  'tour.suspended': {
    label: 'Đình chỉ tour',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  'user.banned': {
    label: 'Khóa tài khoản',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  'user.unbanned': {
    label: 'Mở khóa tài khoản',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200/80',
  },
  'user.deleted': {
    label: 'Xóa người dùng',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  'user.access_assigned': {
    label: 'Đổi vai trò người dùng',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  'agency.verification_decided': {
    label: 'Duyệt hồ sơ công ty',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200/80',
  },
  'agency.member_changed': {
    label: 'Cập nhật thành viên công ty',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'agency.invitation_created': {
    label: 'Mời thành viên công ty',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  'agency.invitation_accepted': {
    label: 'Chấp nhận lời mời công ty',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  'settings.commission_updated': {
    label: 'Cập nhật hoa hồng sàn',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  'settings.agency_commission_updated': {
    label: 'Cập nhật phí dịch vụ agency',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  'settings.policy_updated': {
    label: 'Cập nhật chính sách',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'category.created': {
    label: 'Tạo danh mục tour',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
  'category.updated': {
    label: 'Chỉnh sửa danh mục tour',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
  'category.deleted': {
    label: 'Vô hiệu hóa danh mục',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
  },
  'promotion.platform_changed': {
    label: 'Cập nhật khuyến mãi',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
  'premium.changed': {
    label: 'Thay đổi gói Premium',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
  },
  'audit.exported': {
    label: 'Xuất file báo cáo',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

const TARGET_TYPE_MAP: Record<string, string> = {
  review: 'Đánh giá',
  tour: 'Tour du lịch',
  report: 'Báo cáo vi phạm',
  user: 'Tài khoản',
  agency: 'Công ty lữ hành',
  'agency-role': 'Vai trò công ty',
  'agency-member': 'Nhân sự công ty',
  'agency-invitation': 'Lời mời công ty',
  'agency-join-code': 'Mã gia nhập công ty',
  'agency-join-request': 'Yêu cầu gia nhập công ty',
  category: 'Danh mục tour',
  policy: 'Chính sách',
  commission: 'Hoa hồng sàn',
  setting: 'Phí dịch vụ và chính sách',
  promotion: 'Khuyến mãi',
  support_ticket: 'Yêu cầu hỗ trợ',
  'guide-payout': 'Thanh toán HDV',
  guide_payout: 'Thanh toán HDV',
  Premium: 'Gói Premium',
  'audit-logs': 'Nhật ký hoạt động',
  moderation: 'Hoạt động kiểm duyệt',
};

const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị cấp cao',
  MODERATOR: 'Kiểm duyệt viên',
  AGENCY: 'Công ty du lịch',
  TOUR_GUIDE: 'Hướng dẫn viên',
  TRAVELER: 'Khách du lịch',
};

const FIELD_LABEL_MAP: Record<string, string> = {
  status: 'Trạng thái',
  hiddenReason: 'Lý do ẩn',
  reason: 'Lý do',
  rejectReason: 'Lý do từ chối',
  role: 'Vai trò tài khoản',
  ratePercent: 'Mức hoa hồng (%)',
  rateBps: 'Mức hoa hồng (%)',
  isActive: 'Trạng thái kích hoạt',
  isArchived: 'Lưu trữ',
  title: 'Tiêu đề',
  name: 'Tên hiển thị',
  sortOrder: 'Thứ tự hiển thị',
  staffStatus: 'Trạng thái nhân sự',
  companyName: 'Tên công ty',
  email: 'Email',
  description: 'Mô tả',
  content: 'Nội dung',
  cancellationWindowHours: 'Thời hạn hủy (giờ)',
  slaHours: 'Thời gian xử lý (giờ)',
  escalationSlaHours: 'Thời gian chuyển cấp (giờ)',
  extraPermissions: 'Quyền được bổ sung',
  revokedPermissions: 'Quyền đã gỡ',
};

const VALUE_TRANSLATION_MAP: Record<string, string> = {
  HIDDEN: 'Đã ẩn',
  VISIBLE: 'Đang hiển thị',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã tắt',
  BANNED: 'Đã khóa',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  PENDING: 'Chờ duyệt',
  SUSPENDED: 'Đã đình chỉ',
  SUPER_ADMIN: 'Quản trị cấp cao',
  MODERATOR: 'Kiểm duyệt viên',
  AGENCY: 'Công ty du lịch',
  TOUR_GUIDE: 'Hướng dẫn viên',
  TRAVELER: 'Khách du lịch',
  true: 'Bật / Hoạt động',
  false: 'Tắt / Vô hiệu hóa',
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Bật' : 'Tắt';
  if (typeof val === 'object') return 'Đã cập nhật';
  const str = String(val);
  return VALUE_TRANSLATION_MAP[str] ?? str;
}

function formatFieldValue(field: string, value: unknown): string {
  if (field === 'rateBps' && typeof value === 'number') return `${value / 100}%`;
  return formatValue(value);
}

function getActionInfo(action: string): ActionConfig {
  if (ACTION_MAP[action]) return ACTION_MAP[action];
  return {
    label: 'Cập nhật thông tin',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };
}

/* =========================================================================
   Subcomponents
   ========================================================================= */

function AuditDetailModal({ item, onClose }: { item: Audit | null; onClose: () => void }) {
  if (!item) return null;
  const actionInfo = getActionInfo(item.action);
  const metadata = item.metadata ?? {};
  const reason = (metadata.reason ?? metadata.hiddenReason ?? metadata.rejectReason) as string | undefined;
  const before = (metadata.before && typeof metadata.before === 'object' ? metadata.before : null) as Record<string, unknown> | null;
  const after = (metadata.after && typeof metadata.after === 'object' ? metadata.after : null) as Record<string, unknown> | null;

  // Build diff rows between before & after
  const diffKeys = new Set<string>();
  if (before) Object.keys(before).forEach((k) => diffKeys.add(k));
  if (after) Object.keys(after).forEach((k) => diffKeys.add(k));
  // Filter out internal noisy fields like timestamps or unchanged items
  const diffList = Array.from(diffKeys)
    .filter((k) => k !== 'updatedAt' && k !== 'createdAt' && !k.endsWith('Id') && !k.toLowerCase().endsWith('ids'))
    .map((k) => ({
      key: k,
      label: FIELD_LABEL_MAP[k] ?? 'Thông tin liên quan',
      oldVal: before ? formatFieldValue(k, before[k]) : undefined,
      newVal: after ? formatFieldValue(k, after[k]) : undefined,
      changed: before && after ? JSON.stringify(before[k]) !== JSON.stringify(after[k]) : true,
    }));

  // Extra metadata keys (not in before/after and not reason)
  const extraKeys = Object.keys(metadata).filter((k) =>
    k !== 'before' && k !== 'after' && k !== 'reason' && k !== 'hiddenReason' && k !== 'rejectReason' &&
    FIELD_LABEL_MAP[k] && !k.endsWith('Id') && !k.toLowerCase().endsWith('ids'),
  );

  return (
    <Modal open title="Chi tiết nhật ký thao tác" onClose={onClose} className="max-w-2xl">
      <div className="space-y-5 text-sm">
        {/* Header Summary Card */}
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 sm:grid-cols-2">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Thao tác</span>
            <div className="mt-1">
              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${actionInfo.badgeClass}`}>
                {actionInfo.label}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Thời điểm</span>
            <p className="mt-1 font-medium text-slate-800">{formatSmartDateTime(item.createdAt)}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Người thực hiện</span>
            <p className="mt-1 font-medium text-slate-800">{item.actorName ?? 'Tài khoản đã xóa'}</p>
            <p className="text-xs text-slate-500">{ROLE_MAP[item.actorRole ?? ''] ?? 'Quản trị viên'}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Nội dung</span>
            <p className="mt-1 font-semibold text-slate-800">{TARGET_TYPE_MAP[item.targetType] ?? 'Nội dung trên nền tảng'}</p>
          </div>
        </div>

        {/* Reason Callout Box */}
        {reason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <MessageSquare size={15} className="text-amber-700" />
              <span>Lý do:</span>
            </div>
            <p className="mt-2 text-sm text-amber-950 font-medium leading-relaxed italic">
              "{reason}"
            </p>
          </div>
        )}

        {/* Before vs After Diff Table */}
        {diffList.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Bảng so sánh thay đổi
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-[11px] text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-3.5 py-2.5">Nội dung</th>
                    <th className="px-3.5 py-2.5">Trước khi đổi</th>
                    <th className="px-3.5 py-2.5">Sau khi đổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {diffList.map((row) => (
                    <tr key={row.key} className={row.changed ? 'bg-amber-50/20' : ''}>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-800">{row.label}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5">{formatValue(row.oldVal)}</span>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-teal-800">
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 border border-teal-200/50">{formatValue(row.newVal)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Extra Metadata Fields */}
        {extraKeys.length > 0 && !before && !after && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Thông tin chi tiết
            </h3>
            <dl className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              {extraKeys.map((k) => (
                <div key={k} className="text-xs">
                  <dt className="text-slate-500 font-medium">{FIELD_LABEL_MAP[k] ?? k}:</dt>
                  <dd className="font-semibold text-slate-800 mt-0.5">{formatValue(metadata[k])}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================================
   Main Audit Page
   ========================================================================= */

export function AdminAuditPage() {
  const { ready } = useAdminSession();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [action, setAction] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  const filter = {
    ...(from ? { from: `${from}T00:00:00+07:00` } : {}),
    ...(to ? { to: `${to}T23:59:59.999+07:00` } : {}),
    ...(targetType !== 'all' ? { targetType } : {}),
    ...(action !== 'all' ? { action } : {}),
    order: sortOrder,
  };

  const query = api.useAuditListQuery({ page, ...filter }, { skip: !ready, refetchOnMountOrArgChange: true });
  const [download, state] = api.useExportAuditMutation();
  const [error, setError] = useState<string | null>(null);

  const exportFile = async (resource: 'audit-logs' | 'moderation') => {
    setError(null);
    try {
      const csv = await download({ resource, ...filter }).unwrap();
      const url = URL.createObjectURL(
        new Blob(['\uFEFF', csv.replace(/^\uFEFF/, '')], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(adminError(e));
    }
  };

  if (!ready) return null;

  return (
    <AdminFrame
      title="Lịch sử hoạt động"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={state.isLoading}
            onClick={() => void exportFile('audit-logs')}
            className="flex items-center gap-1.5 text-xs font-semibold"
            title="Tải danh sách hoạt động xuống máy"
          >
            <Download size={15} />
            <span>Tải danh sách hoạt động</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={state.isLoading}
            onClick={() => void exportFile('moderation')}
            className="flex items-center gap-1.5 text-xs font-semibold"
            title="Tải danh sách hoạt động kiểm duyệt xuống máy"
          >
            <FileSpreadsheet size={15} />
            <span>Tải hoạt động kiểm duyệt</span>
          </Button>
        </div>
      }
      error={query.error}
      loading={query.isLoading}
      loadingSkeleton={<AdminAuditSkeleton />}
      refreshing={query.isFetching}
      onRefresh={() => query.refetch()}
    >
      <Feedback error={error} />

      {/* Toolbar filter */}
      <div className={`${toolbar} items-end sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1.5fr_auto]`}>
        <FormField label="Từ ngày" htmlFor="audit-from">
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Đến ngày" htmlFor="audit-to">
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </FormField>
        <FormField label="Nhóm nội dung" htmlFor="audit-target-filter">
          <FormSelect
            id="audit-target-filter"
            className={control}
            value={targetType}
            onChange={(e) => {
              setPage(1);
              setTargetType(e.target.value);
            }}
          >
            <option value="all">Tất cả đối tượng</option>
            {Object.entries(TARGET_TYPE_MAP).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FormSelect>
        </FormField>
        <FormField label="Thao tác" htmlFor="audit-action-filter">
          <FormSelect
            id="audit-action-filter"
            className={control}
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          >
            <option value="all">Tất cả thao tác</option>
            {Object.entries(ACTION_MAP).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </FormSelect>
        </FormField>
        <div className="flex items-end">
          <Button
            variant="ghost"
            onClick={() => {
              setPage(1);
              setFrom('');
              setTo('');
              setTargetType('all');
              setAction('all');
              setSortOrder('desc');
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap sm:w-auto"
          >
            <RotateCcw size={15} />
            Đặt lại
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <section className={`${panel} !p-0 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">
            Hoạt động gần đây
            {query.data?.items && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                {query.data.items.length} bản ghi trang này
              </span>
            )}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSortOrder((cur) => (cur === 'desc' ? 'asc' : 'desc'));
                    }}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-700 transition"
                  >
                    Thời gian
                    {sortOrder === 'desc'
                      ? <ArrowDown size={13} className="text-teal-600" />
                      : <ArrowUp size={13} className="text-teal-600" />}
                  </button>
                </th>
                <th className="px-4 py-3.5 font-medium">Thao tác</th>
                <th className="px-4 py-3.5 font-medium">Người thực hiện</th>
                <th className="px-4 py-3.5 font-medium">Nội dung</th>
                <th className="px-5 py-3.5 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data?.items.map((r) => {
                const actionInfo = getActionInfo(r.action);
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70 align-top">
                    {/* Thời gian */}
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                      {formatSmartDateTime(r.createdAt)}
                    </td>

                    {/* Thao tác */}
                    <td className="px-4 py-4">
                      <div>
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${actionInfo.badgeClass}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                    </td>

                    {/* Người thực hiện */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span className="block font-medium text-slate-900">{r.actorName ?? 'Tài khoản đã xóa'}</span>
                        <span className="block text-xs text-slate-500">{ROLE_MAP[r.actorRole ?? ''] ?? 'Quản trị viên'}</span>
                      </div>
                    </td>

                    {/* Đối tượng */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs text-slate-900 block">{TARGET_TYPE_MAP[r.targetType] ?? 'Nội dung trên nền tảng'}</span>
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Thành công
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAudit(r)}
                          className="!h-7 px-2 text-xs font-semibold text-teal-800 hover:text-teal-900 hover:bg-teal-50 flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Xem chi tiết</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {query.data?.items.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Không tìm thấy nhật ký"
              description="Không có thao tác nào trong khoảng thời gian hoặc bộ lọc đã chọn."
            />
          </div>
        )}
      </section>

      {/* Pagination */}
      {query.data && query.data.meta.totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={query.data.meta.totalPages}
          pageSize={15}
          showInfo
          disabled={query.isFetching}
          onPageChange={setPage}
        />
      )}

      {/* Detail Modal */}
      {selectedAudit && (
        <AuditDetailModal
          item={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}
    </AdminFrame>
  );
}
