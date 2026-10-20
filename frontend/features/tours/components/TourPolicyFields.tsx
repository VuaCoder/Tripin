'use client';

import { useState } from 'react';
import type { TourContentInput } from '../types';
import { TourAgePricingFields } from './TourAgePricingFields';
import { ShieldCheck, FileText, AlertCircle, Sparkles, Plus, Trash2, RotateCcw } from 'lucide-react';

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
    badge: 'Hủy miễn phí trước 48h',
    description: 'Phù hợp city tour, tour ngắn ngày',
    milestones: [
      { id: 'flex-1', daysBefore: 48, timeUnit: 'hour' as const, refundPercent: 100 },
    ],
  },
  {
    id: 'standard',
    title: 'Tiêu chuẩn',
    badge: '7 ngày 100% · 3 ngày 50% · 1 ngày 20%',
    description: 'Chính sách phổ biến nhất của các tour du lịch',
    milestones: [
      { id: 'std-1', daysBefore: 7, timeUnit: 'day' as const, refundPercent: 100 },
      { id: 'std-2', daysBefore: 3, timeUnit: 'day' as const, refundPercent: 50 },
      { id: 'std-3', daysBefore: 1, timeUnit: 'day' as const, refundPercent: 20 },
    ],
  },
  {
    id: 'strict',
    title: 'Nghiêm ngặt',
    badge: '15 ngày 70% · 7 ngày 30%',
    description: 'Dành cho tour có vé máy bay hoặc khách sạn 5 sao',
    milestones: [
      { id: 'str-1', daysBefore: 15, timeUnit: 'day' as const, refundPercent: 70 },
      { id: 'str-2', daysBefore: 7, timeUnit: 'day' as const, refundPercent: 30 },
    ],
  },
  {
    id: 'non_refundable',
    title: 'Không hoàn tiền',
    badge: 'Non-refundable (0%)',
    description: 'Áp dụng cho tour khuyến mãi giờ chót, dịp Lễ Tết',
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

  // Track whether the user has manually edited the text in the textarea
  const [isCustomText, setIsCustomText] = useState(false);

  // Apply template
  const handleApplyTemplate = (templateId: string) => {
    const tmpl = CANCELLATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    setMilestones(tmpl.milestones);
    const newText = generateCancellationPolicyText(tmpl.milestones);
    setIsCustomText(false);
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
    setIsCustomText(false);
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
    setIsCustomText(false);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Remove a milestone row
  const removeMilestone = (id: string) => {
    if (milestones.length <= 1) return;
    const nextMilestones = milestones.filter((m) => m.id !== id);
    setMilestones(nextMilestones);

    const newText = generateCancellationPolicyText(nextMilestones);
    setIsCustomText(false);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Regenerate textarea from milestones
  const handleRegenerateFromMilestones = () => {
    const newText = generateCancellationPolicyText(milestones);
    setIsCustomText(false);
    onChange({ ...value, cancellationPolicy: newText });
  };

  // Free custom textarea edit
  const handleCustomTextChange = (text: string) => {
    setIsCustomText(true);
    onChange({ ...value, cancellationPolicy: text });
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

  const toggleTravelNoteOption = (opt: TravelNoteOption) => {
    const lineItem = `• ${opt.description}`;
    const current = value.travelNotes || '';
    if (current.includes(opt.description)) {
      const cleaned = current
        .split('\n')
        .filter((line) => !line.includes(opt.description))
        .join('\n')
        .trim();
      onChange({ ...value, travelNotes: cleaned });
    } else {
      const next = current.trim() ? `${current.trim()}\n${lineItem}` : lineItem;
      onChange({ ...value, travelNotes: next });
    }
  };

  return (
    <div className="space-y-6">
      {/* Optional Age pricing if rendered standalone */}
      {includeAgePricing && (
        <TourAgePricingFields value={value} onChange={onChange} />
      )}

      {/* 1. Cancellation & Refund Policy Builder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Chính sách đổi, hủy tour (Cancellation & Refund) <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {(value.cancellationPolicy || '').length}/5000 ký tự
          </span>
        </div>

        {/* Quick Suggestion Templates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Chọn nhanh gói mẫu (hoặc tự do tạo các mốc bên dưới):
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {CANCELLATION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl.id)}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-left transition hover:border-[#087e8b] hover:bg-teal-50/40 cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-[#087e8b] transition-colors">
                      {tmpl.title}
                    </span>
                    <span className="text-[10px] text-teal-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Áp dụng ↵
                    </span>
                  </div>
                  <span className="inline-block rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200/80 mb-1">
                    {tmpl.badge}
                  </span>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    {tmpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Milestones Builder */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
              Bảng thiết lập các mốc hoàn hủy:
            </span>
            <span className="text-xs text-slate-500">
              {milestones.length} mốc quy định
            </span>
          </div>

          <div className="space-y-2.5">
            {milestones.map((milestone, index) => (
              <div
                key={milestone.id}
                className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition hover:border-slate-300"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-teal-100/70 text-xs font-bold text-teal-800">
                  {index + 1}
                </span>

                {/* If cancel before: input + unit */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span>Nếu hủy trước</span>
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
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-bold text-slate-900 outline-none focus:border-[#087e8b] focus:ring-1 focus:ring-[#087e8b]"
                  />
                  <select
                    value={milestone.timeUnit}
                    aria-label={`Đơn vị thời gian mốc ${index + 1}`}
                    onChange={(e) =>
                      updateMilestone(milestone.id, {
                        timeUnit: e.target.value as 'day' | 'hour',
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#087e8b]"
                  >
                    <option value="day">ngày</option>
                    <option value="hour">giờ</option>
                  </select>
                </div>

                <span className="text-xs text-slate-400 font-bold hidden sm:inline">→</span>

                {/* Refund percentage input */}
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <span>Được hoàn</span>
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
                      className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-bold text-[#087e8b] outline-none focus:border-[#087e8b] focus:ring-1 focus:ring-[#087e8b]"
                    />
                    <span className="pointer-events-none absolute right-2 text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>

                {/* Status tag */}
                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
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
                      ? 'Không hoàn tiền'
                      : `Phí phạt ${100 - milestone.refundPercent}%`}
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

          {/* Add milestone action & No-show note */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-teal-200/50">
            <button
              type="button"
              onClick={addMilestone}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#087e8b] bg-white px-3.5 py-1.5 text-xs font-bold text-[#087e8b] hover:bg-teal-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={15} />
              <span>Thêm mốc hoàn hủy</span>
            </button>

            <span className="text-[11px] text-slate-500 italic">
              ℹ️ Sát giờ khởi hành hoặc vắng mặt (No-show): Tự động tính phí hủy 100%
            </span>
          </div>
        </div>

        {/* Final Textarea with customization support */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="tour-cancellation-policy-textarea" className="text-xs font-semibold text-slate-700 block">
              Nội dung điều khoản chi tiết (hiển thị công khai cho du khách):
            </label>
            <div className="flex items-center gap-2">
              {isCustomText ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                  ✏️ Đã chỉnh sửa thủ công
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/60">
                  ✓ Tự động cập nhật theo các mốc
                </span>
              )}

              {isCustomText && (
                <button
                  type="button"
                  onClick={handleRegenerateFromMilestones}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#087e8b] hover:underline cursor-pointer"
                  title="Xóa nội dung chỉnh tay và tạo lại theo các mốc trên"
                >
                  <RotateCcw size={12} />
                  <span>Tạo lại từ bảng mốc</span>
                </button>
              )}
            </div>
          </div>

          <textarea
            id="tour-cancellation-policy-textarea"
            rows={4}
            maxLength={5000}
            value={value.cancellationPolicy || ''}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            placeholder="Quy định hoàn tiền, các mốc thời gian báo hủy trước ngày khởi hành..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20 leading-relaxed font-sans"
          />
          <p className="text-[11px] text-slate-400">
            Nội dung này được hệ thống sinh sẵn theo các mốc bạn nhập ở trên. Bạn hoàn toàn có thể gõ thêm điều kiện vé bay, phí nhượng tour hoặc lưu ý riêng tùy ý.
          </p>
        </div>
      </div>

      {/* 2. Required Documents Checklist */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Giấy tờ tùy thân khi tham gia tour <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {(value.requiredDocuments || '').length}/5000 ký tự
          </span>
        </div>

        {/* Concise Multiple Choice Chips */}
        <div>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
            <Sparkles size={14} className="text-amber-500" />
            Chọn nhanh các loại giấy tờ yêu cầu (nội dung chi tiết sẽ tự động điền vào ô bên dưới):
          </span>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_OPTIONS.map((opt) => {
              const isSelected = (value.requiredDocuments || '').includes(opt.description);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDocumentOption(opt)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-[#087e8b] bg-[#087e8b] text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-[#087e8b]'}`}>
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <label htmlFor="tour-required-documents-textarea" className="text-xs font-semibold text-slate-600 block">
            Nội dung hiển thị cho du khách:
          </label>
          <textarea
            id="tour-required-documents-textarea"
            rows={3}
            maxLength={5000}
            value={value.requiredDocuments || ''}
            onChange={(e) => onChange({ ...value, requiredDocuments: e.target.value })}
            placeholder="Ví dụ: CCCD/Hộ chiếu bản gốc, giấy khai sinh cho trẻ em..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
          />
        </div>
      </div>

      {/* 3. Travel Notes Checklist */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-[#087e8b]" />
            <h3 className="text-sm font-bold text-slate-900">
              Lưu ý quan trọng cho chuyến đi <span className="text-xs font-normal text-slate-500">(Optional)</span>
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {(value.travelNotes || '').length}/5000 ký tự
          </span>
        </div>

        {/* Concise Multiple Choice Chips */}
        <div>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
            <Sparkles size={14} className="text-amber-500" />
            Chọn nhanh các lưu ý thường gặp (nội dung chi tiết sẽ tự động điền vào ô bên dưới):
          </span>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_NOTE_OPTIONS.map((opt) => {
              const isSelected = (value.travelNotes || '').includes(opt.description);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleTravelNoteOption(opt)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-[#087e8b] bg-[#087e8b] text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-[#087e8b]'}`}>
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <label htmlFor="tour-travel-notes-textarea" className="text-xs font-semibold text-slate-600 block">
            Nội dung chi tiết:
          </label>
          <textarea
            id="tour-travel-notes-textarea"
            rows={3}
            maxLength={5000}
            value={value.travelNotes || ''}
            onChange={(e) => onChange({ ...value, travelNotes: e.target.value })}
            placeholder="Lưu ý về trang phục, sức khỏe, giờ giấc tập trung, thời tiết..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
          />
        </div>
      </div>
    </div>
  );
}
