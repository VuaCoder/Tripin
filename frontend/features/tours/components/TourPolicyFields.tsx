'use client';

import { useState, useEffect } from 'react';
import type { TourContentInput } from '../types';
import { TourAgePricingFields } from './TourAgePricingFields';
import { ShieldCheck, FileText, AlertCircle, Sparkles, Plus, Trash2, Check } from 'lucide-react';

interface Props {
  value: TourContentInput;
  onChange: (value: TourContentInput) => void;
  includeAgePricing?: boolean;
}

export interface CancellationMilestone {
  id: string;
  daysBefore: number;
  timeUnit: 'day' | 'hour';
  refundPercent: number;
}

// Default standard OTA presets for 1-click loading into the milestone builder
const CANCELLATION_TEMPLATES = [
  {
    id: 'flexible',
    title: 'Linh hoạt',
    milestones: [
      { id: 'flex-1', daysBefore: 48, timeUnit: 'hour' as const, refundPercent: 100 },
    ],
  },
  {
    id: 'standard',
    title: 'Tiêu chuẩn',
    milestones: [
      { id: 'std-1', daysBefore: 7, timeUnit: 'day' as const, refundPercent: 100 },
      { id: 'std-2', daysBefore: 3, timeUnit: 'day' as const, refundPercent: 50 },
      { id: 'std-3', daysBefore: 1, timeUnit: 'day' as const, refundPercent: 20 },
    ],
  },
  {
    id: 'strict',
    title: 'Nghiêm ngặt',
    milestones: [
      { id: 'str-1', daysBefore: 15, timeUnit: 'day' as const, refundPercent: 70 },
      { id: 'str-2', daysBefore: 7, timeUnit: 'day' as const, refundPercent: 30 },
    ],
  },
  {
    id: 'non_refundable',
    title: 'Không hoàn tiền',
    milestones: [
      { id: 'nr-1', daysBefore: 0, timeUnit: 'day' as const, refundPercent: 0 },
    ],
  },
];

// Helper to auto-generate readable policy text from milestones
export function generateCancellationPolicyText(milestones: CancellationMilestone[]): string {
  if (milestones.length === 0 || (milestones.length === 1 && milestones[0].daysBefore === 0 && milestones[0].refundPercent === 0)) {
    return `• Đặt chỗ không hoàn lại tiền hoặc đổi ngày khởi hành sau khi đã thanh toán thành công.\n• Khách vắng mặt (No-show) vào ngày khởi hành: Không hoàn lại tiền.`;
  }

  // Sort descending by total hours
  const sorted = [...milestones].sort((a, b) => {
    const aHours = a.daysBefore * (a.timeUnit === 'day' ? 24 : 1);
    const bHours = b.daysBefore * (b.timeUnit === 'day' ? 24 : 1);
    return bHours - aHours;
  });

  const lines: string[] = [];

  sorted.forEach((m) => {
    const unitLabel = m.timeUnit === 'day' ? 'ngày' : 'giờ';
    if (m.refundPercent === 100) {
      lines.push(`• Nếu hủy trước ${m.daysBefore} ${unitLabel} trước ngày khởi hành: Bạn được hoàn 100% giá trị tour.`);
    } else if (m.refundPercent === 0) {
      lines.push(`• Nếu hủy trước ${m.daysBefore} ${unitLabel} trước ngày khởi hành: Không hoàn lại tiền (phí hủy 100%).`);
    } else {
      lines.push(
        `• Nếu hủy trước ${m.daysBefore} ${unitLabel} trước ngày khởi hành: Bạn được hoàn ${m.refundPercent}% giá trị tour (phí hủy ${100 - m.refundPercent}%).`
      );
    }
  });

  const minMilestone = sorted[sorted.length - 1];
  if (minMilestone && minMilestone.refundPercent > 0) {
    const unitLabel = minMilestone.timeUnit === 'day' ? 'ngày' : 'giờ';
    lines.push(`• Nếu hủy trong vòng ${minMilestone.daysBefore} ${unitLabel} trước ngày khởi hành hoặc vắng mặt (No-show): Không hoàn lại tiền.`);
  } else {
    lines.push(`• Khách vắng mặt (No-show) vào ngày khởi hành: Không hoàn lại tiền.`);
  }

  return lines.join('\n');
}

// Initial milestone builder state
const DEFAULT_INITIAL_MILESTONES: CancellationMilestone[] = [
  { id: 'm-1', daysBefore: 7, timeUnit: 'day', refundPercent: 100 },
  { id: 'm-2', daysBefore: 3, timeUnit: 'day', refundPercent: 50 },
  { id: 'm-3', daysBefore: 1, timeUnit: 'day', refundPercent: 20 },
];

// Concise multiple choice options for required documents with full descriptive text
export interface DocumentOption {
  id: string;
  label: string;
  description: string;
}

export const DOCUMENT_OPTIONS: DocumentOption[] = [
  {
    id: 'cccd',
    label: 'CCCD / CMND',
    description: 'Căn cước công dân (CCCD) hoặc CMND bản gốc còn hiệu lực sử dụng.',
  },
  {
    id: 'passport',
    label: 'Hộ chiếu (Passport)',
    description: 'Hộ chiếu (Passport) bản gốc còn thời hạn tối thiểu 6 tháng tính đến ngày kết thúc tour.',
  },
  {
    id: 'birth_cert',
    label: 'Giấy khai sinh (Trẻ em)',
    description: 'Giấy khai sinh bản sao trích lục hoặc công chứng (bắt buộc cho trẻ em dưới 14 tuổi chưa có CCCD).',
  },
  {
    id: 'visa',
    label: 'Visa / Thị thực',
    description: 'Visa / Thị thực nhập cảnh hoặc giấy miễn thị thực hợp lệ (đối với khách quốc tịch nước ngoài hoặc Việt kiều).',
  },
  {
    id: 'driver_license',
    label: 'Bằng lái xe',
    description: 'Giấy phép lái xe hợp lệ còn hạn sử dụng (dành cho tour có hoạt động tự lái xe hoặc thuê xe máy).',
  },
  {
    id: 'student_senior',
    label: 'Thẻ ưu đãi / HSSV',
    description: 'Thẻ học sinh, sinh viên hoặc người cao tuổi để hưởng chính sách giảm giá vé tham quan thắng cảnh.',
  },
  {
    id: 'health_cert',
    label: 'Giấy khám sức khỏe',
    description: 'Giấy xác nhận đủ điều kiện sức khỏe tham gia các hoạt động thể thao mạo hiểm hoặc leo núi trekking.',
  },
];

// Concise multiple choice options for travel notes with full descriptive text
export interface TravelNoteOption {
  id: string;
  label: string;
  description: string;
}

export const TRAVEL_NOTE_OPTIONS: TravelNoteOption[] = [
  {
    id: 'temple_clothing',
    label: 'Trang phục lịch sự',
    description: 'Trang phục lịch sự, kín đáo khi tham quan các điểm tâm linh, di tích lịch sử.',
  },
  {
    id: 'walking_shoes',
    label: 'Giày thể thao / Giày bệt',
    description: 'Mang giày thể thao hoặc giày bệt êm chân để thuận tiện cho việc di chuyển.',
  },
  {
    id: 'sun_protection',
    label: 'Mũ nón & Chống nắng',
    description: 'Chuẩn bị mũ nón rộng vành, kem chống nắng và áo khoác nhẹ.',
  },
  {
    id: 'medicine',
    label: 'Thuốc men cá nhân',
    description: 'Mang theo thuốc say xe và các loại thuốc điều trị đặc trị cá nhân.',
  },
  {
    id: 'gathering_time',
    label: 'Có mặt trước 20 phút',
    description: 'Có mặt tại điểm tập trung trước giờ khởi hành ít nhất 20 phút.',
  },
];

export function TourPolicyFields({ value, onChange, includeAgePricing = false }: Props) {
  // Milestones in the builder
  const [milestones, setMilestones] = useState<CancellationMilestone[]>(() => {
    // If empty or new, use default standard milestones
    return DEFAULT_INITIAL_MILESTONES;
  });

  // Ensure cancellationPolicy is populated from default milestones on mount if empty
  useEffect(() => {
    if (!value.cancellationPolicy) {
      onChange({ ...value, cancellationPolicy: generateCancellationPolicyText(milestones) });
    }
  }, []);

  // Apply template
  const handleApplyTemplate = (templateId: string) => {
    const tmpl = CANCELLATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    setMilestones(tmpl.milestones);
    const newText = generateCancellationPolicyText(tmpl.milestones);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Update a single milestone row
  const updateMilestone = (
    id: string,
    updates: Partial<Omit<CancellationMilestone, 'id'>>
  ) => {
    const nextMilestones = milestones.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
    setMilestones(nextMilestones);

    // Auto-update generated text
    const newText = generateCancellationPolicyText(nextMilestones);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Add new milestone row
  const addMilestone = () => {
    const newId = `m-${Date.now()}`;
    const nextMilestones = [
      ...milestones,
      { id: newId, daysBefore: 1, timeUnit: 'day' as const, refundPercent: 50 },
    ];
    setMilestones(nextMilestones);

    const newText = generateCancellationPolicyText(nextMilestones);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Remove a milestone row
  const removeMilestone = (id: string) => {
    if (milestones.length <= 1) return;
    const nextMilestones = milestones.filter((m) => m.id !== id);
    setMilestones(nextMilestones);

    const newText = generateCancellationPolicyText(nextMilestones);
    onChange({ ...value, cancellationPolicy: newText });
  };

  const toggleDocumentOption = (opt: DocumentOption) => {
    const lineItem = `• ${opt.description}`;
    const current = value.requiredDocuments || '';
    if (current.includes(opt.description)) {
      const cleaned = current
        .split('\n')
        .filter((line) => !line.includes(opt.description))
        .join('\n')
        .trim();
      onChange({ ...value, requiredDocuments: cleaned });
    } else {
      const next = current.trim() ? `${current.trim()}\n${lineItem}` : lineItem;
      onChange({ ...value, requiredDocuments: next });
    }
  };

  return (
    <div className="space-y-6">
      {/* Optional Age pricing if rendered standalone */}
      {includeAgePricing && (
        <TourAgePricingFields value={value} onChange={onChange} />
      )}

      {/* 1. Cancellation & Refund Policy Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Chính sách đổi, hủy tour (Cancellation & Refund)
            </h3>
          </div>
        </div>

        {/* Quick Suggestion Templates */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            Chọn nhanh gói mẫu:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CANCELLATION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl.id)}
                className="rounded-xl border border-slate-200 bg-slate-50/70 py-2 px-3 text-center text-xs font-bold text-slate-800 transition hover:border-[#087e8b] hover:bg-teal-50 hover:text-[#087e8b] cursor-pointer"
              >
                {tmpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Milestones Builder */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              Bảng thiết lập các mốc hoàn hủy:
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {milestones.length} mốc quy định
            </span>
          </div>

          <div className="space-y-2">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-2xs transition hover:border-slate-300"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-800 border border-teal-200/50">
                  {index + 1}
                </span>

                {/* If cancel before: input + unit */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium shrink-0">
                  <span>Hủy trước</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    aria-label={`Số thời gian hủy mốc ${index + 1}`}
                    value={milestone.daysBefore}
                    onChange={(e) =>
                      updateMilestone(milestone.id, {
                        daysBefore: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-13 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-bold text-slate-900 outline-none focus:border-[#087e8b] focus:ring-1 focus:ring-[#087e8b]"
                  />
                  <select
                    value={milestone.timeUnit}
                    aria-label={`Đơn vị thời gian mốc ${index + 1}`}
                    onChange={(e) =>
                      updateMilestone(milestone.id, {
                        timeUnit: e.target.value as 'day' | 'hour',
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#087e8b]"
                  >
                    <option value="day">ngày</option>
                    <option value="hour">giờ</option>
                  </select>
                </div>

                <span className="text-xs text-slate-400 font-bold shrink-0">→</span>

                {/* Refund percentage input */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium shrink-0">
                  <span>Hoàn</span>
                  <div className="relative inline-flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`Tỷ lệ hoàn tiền mốc ${index + 1}`}
                      value={milestone.refundPercent}
                      onChange={(e) =>
                        updateMilestone(milestone.id, {
                          refundPercent: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="w-13 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-bold text-[#087e8b] outline-none focus:border-[#087e8b] focus:ring-1 focus:ring-[#087e8b]"
                    />
                    <span className="pointer-events-none absolute right-1.5 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>

                {/* Status tag */}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <span
                    className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                      milestone.refundPercent === 100
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : milestone.refundPercent === 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-teal-200 bg-teal-50 text-teal-800'
                    }`}
                  >
                    {milestone.refundPercent === 100
                      ? 'Miễn phí hủy'
                      : milestone.refundPercent === 0
                      ? 'Không hoàn'
                      : `Phạt ${100 - milestone.refundPercent}%`}
                  </span>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeMilestone(milestone.id)}
                    disabled={milestones.length <= 1}
                    aria-label={`Xóa mốc ${index + 1}`}
                    title="Xóa mốc này"
                    className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add milestone action */}
          <div className="pt-0.5">
            <button
              type="button"
              onClick={addMilestone}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#087e8b]/70 bg-white px-3 py-1.5 text-xs font-bold text-[#087e8b] hover:bg-teal-50 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm mốc hoàn hủy</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 italic pt-0.5">
          Quy định hoàn hủy sẽ được tự động áp dụng theo các mốc thiết lập ở trên khi du khách đặt tour.
        </p>
      </div>

      {/* 2. Giấy tờ tùy thân (Tách riêng, giữ lại gợi ý) */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Giấy tờ tùy thân
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {(value.requiredDocuments || '').length}/5000 ký tự
          </span>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">Gợi ý nhanh:</span>
          {DOCUMENT_OPTIONS.map((opt) => {
            const isSelected = (value.requiredDocuments || '').includes(opt.description);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleDocumentOption(opt)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                  isSelected
                    ? 'border-teal-300 bg-teal-50 text-teal-800 font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700'
                }`}
              >
                {isSelected ? <Check size={11} className="shrink-0" /> : <Plus size={11} className="text-slate-400 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          id="tour-required-documents-textarea"
          rows={3}
          maxLength={5000}
          value={value.requiredDocuments || ''}
          onChange={(e) => onChange({ ...value, requiredDocuments: e.target.value })}
          placeholder="Ví dụ: CCCD/Hộ chiếu bản gốc còn hạn, giấy khai sinh cho trẻ em..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15 placeholder:text-slate-400 placeholder:font-normal"
        />
      </div>

      {/* 3. Lưu ý chuyến đi (Tách riêng, bỏ hết gợi ý, chỉ để lại ô text cho người dùng tự nhập) */}
      <div className="space-y-3 pt-5 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Lưu ý chuyến đi
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {(value.travelNotes || '').length}/5000 ký tự
          </span>
        </div>

        <textarea
          id="tour-travel-notes-textarea"
          rows={4}
          maxLength={5000}
          value={value.travelNotes || ''}
          onChange={(e) => onChange({ ...value, travelNotes: e.target.value })}
          placeholder="Ví dụ: Trang phục lịch sự khi vào đền chùa, chuẩn bị áo ấm khi lên núi, có mặt trước giờ hẹn 15-20 phút..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/15 placeholder:text-slate-400 placeholder:font-normal"
        />
      </div>
    </div>
  );
}
