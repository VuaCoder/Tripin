'use client';

import { useEffect, useState, useId, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { 
  useCreateAgencyTourMutation, 
  useGetAgencyTourQuery, 
  useGetTourCategoriesQuery, 
  useUpdateAgencyTourMutation, 
  getTourApiMessage 
} from '../api/toursApi';
import type { TourContentInput } from '../types';
import { AgencyTourLivePreview } from './AgencyTourLivePreview';
import { AgencyTourStepper } from './AgencyTourStepper';
import { RequiredMark, TourFieldHint } from './TourFieldHint';
import { editorFields, fieldStep, validateTourEditor, tourEditorServerErrors, type EditorField, type EditorErrors } from './tourEditorValidation';
import editorStyles from './AgencyTourEditor.module.css';

const emptyForm: TourContentInput = { 
  title: '', 
  destination: '', 
  durationDays: 1, 
  basePrice: 0, 
  categoryIds: [], 
  images: [], 
  inclusions: [], 
  exclusions: [] 
};

// Preset high quality photos for quick 1-click branding
const PRESET_PHOTOS = [
  { label: 'Hà Giang Mùa Hoa', url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80' },
  { label: 'Sapa Mây Ngàn', url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80' },
  { label: 'Vịnh Hạ Long', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { label: 'Tràng An Ninh Bình', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80' },
  { label: 'Phố Cổ Hội An', url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Côn Đảo / Biển Đảo', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' },
];

const QUICK_DESTINATIONS = ['Hà Giang', 'Sapa', 'Hạ Long', 'Ninh Bình', 'Hội An', 'Phú Quốc', 'Huế', 'Đà Lạt'];

const DEFAULT_INCLUSIONS = [
  'Xe đưa đón đời mới theo lịch trình',
  'Khách sạn tiêu chuẩn 3 - 4 sao',
  'Các bữa ăn theo thực đơn tour',
  'Vé tham quan tất cả các điểm',
  'Hướng dẫn viên nhiệt tình, chu đáo',
  'Bảo hiểm du lịch trọn gói'
];

const DEFAULT_EXCLUSIONS = [
  'Chi phí cá nhân ngoài chương trình',
  'Đồ uống gọi thêm trong bữa ăn',
  'Thuế VAT 8% hoặc 10%',
  'Tiền tip cho hướng dẫn viên và lái xe'
];

type StepId = 1 | 2 | 3 | 4;

const STEPS_CONFIG = [
  { id: 1 as StepId, title: 'Thông tin chung', subtitle: 'Tên tour, điểm đến & thời lượng', icon: 'edit_note' },
  { id: 2 as StepId, title: 'Hình ảnh tour', subtitle: 'Tải ảnh & chọn ảnh bìa sắc nét', icon: 'photo_library' },
  { id: 3 as StepId, title: 'Giá & Dịch vụ', subtitle: 'Giá niêm yết, bao gồm & loại trừ', icon: 'payments' },
  { id: 4 as StepId, title: 'Hoàn tất', subtitle: 'Hướng dẫn viên và xét duyệt', icon: 'badge' },
];

export function AgencyTourEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ id: string }>();
  const id = mode === 'edit' ? params.id : undefined;
  const router = useRouter();
  const { data: tour, isLoading: tourLoading, error: tourError } = useGetAgencyTourQuery(id ?? '', { skip: !id });
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useGetTourCategoriesQuery();
  const [createTour, createState] = useCreateAgencyTourMutation();
  const [updateTour, updateState] = useUpdateAgencyTourMutation();
  const [value, setValue] = useState<TourContentInput>(emptyForm);
  const [pageError, setPageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<EditorErrors>({});
  const formId = useId();
  const fieldId = (field: EditorField) => `${formId}-${field}`;
  const fieldHint = (field: EditorField) => <TourFieldHint id={`${fieldId(field)}-error`} message={fieldErrors[field]} />;
  const fieldProps = (field: EditorField) => ({ id: fieldId(field), 'aria-invalid': !!fieldErrors[field], 'aria-describedby': fieldErrors[field] ? `${fieldId(field)}-error` : undefined, onBlur: () => setFieldErrors((current) => ({ ...current, [field]: validateTourEditor(value)[field] })) });
  const validateFields = (fields: readonly EditorField[], jump = false) => {
    const errors = validateTourEditor(value);
    setFieldErrors((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, errors[field]])) }));
    const first = fields.find((field) => errors[field]);
    if (first && jump) setCurrentStep(fieldStep(first) as StepId);
    return !first;
  };
  const [currentStep, setCurrentStep] = useState<StepId>(1);

  // Sub-states for Step 2 (Images) and Step 3 (Inclusions/Exclusions)
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [customInclusion, setCustomInclusion] = useState('');
  const [customExclusion, setCustomExclusion] = useState('');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const uploadInputId = useId();

  useEffect(() => {
    if (tour) {
      setValue({
        title: tour.title,
        summary: tour.summary ?? '',
        description: tour.description ?? '',
        destination: tour.destination,
        durationDays: tour.durationDays,
        basePrice: tour.basePrice,
        maxGroupSize: tour.maxGroupSize,
        categoryIds: tour.categoryIds ?? [],
        images: tour.images && tour.images.length > 0 ? tour.images : (tour.coverImage ? [tour.coverImage] : []),
        inclusions: tour.inclusions ?? [],
        exclusions: tour.exclusions ?? [],
      });
    }
  }, [tour]);

  const busy = createState.isLoading || updateState.isLoading;
  const locked = tour?.status === 'PENDING_REVIEW';

  const updateField = <K extends keyof TourContentInput>(key: K, nextVal: TourContentInput[K]) => {
    setValue((prev) => ({ ...prev, [key]: nextVal }));
    if (editorFields.includes(key as EditorField)) setFieldErrors((current) => current[key as EditorField] ? { ...current, [key]: validateTourEditor({ ...value, [key]: nextVal })[key as EditorField] } : current);
  };

  const handleAddImageUrl = () => {
    setImageError('');
    if (!customImageUrl.trim()) return;
    try {
      new URL(customImageUrl.trim());
      updateField('images', [...(value.images ?? []), customImageUrl.trim()]);
      setCustomImageUrl('');
      setShowUrlInput(false);
    } catch {
      setImageError('Đường dẫn ảnh chưa đúng. Bạn kiểm tra lại nhé.');
    }
  };

  const processImageFiles = (files: FileList | File[]) => {
    setImageError('');
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!validFiles.length) {
      setImageError('Hãy chọn tệp ảnh JPG, PNG hoặc WebP nhé.');
      return;
    }
    validFiles.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setImageError(`Ảnh “${file.name}” quá lớn. Hãy chọn ảnh không quá 5 MB nhé.`);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => setImageError(`Chưa đọc được ảnh “${file.name}”. Bạn chọn lại ảnh nhé.`);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setValue((prev) => ({
            ...prev,
            images: [...(prev.images ?? []), reader.result as string],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImageFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (indexToRemove: number) => {
    updateField('images', (value.images ?? []).filter((_, i) => i !== indexToRemove));
  };

  const setPrimaryImage = (indexToPrimary: number) => {
    const images = [...(value.images ?? [])];
    const [target] = images.splice(indexToPrimary, 1);
    images.unshift(target);
    updateField('images', images);
  };

  const addInclusionItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (value.inclusions ?? []).includes(trimmed)) return;
    updateField('inclusions', [...(value.inclusions ?? []), trimmed]);
  };

  const removeInclusionItem = (index: number) => {
    updateField('inclusions', (value.inclusions ?? []).filter((_, i) => i !== index));
  };

  const addExclusionItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (value.exclusions ?? []).includes(trimmed)) return;
    updateField('exclusions', [...(value.exclusions ?? []), trimmed]);
  };

  const removeExclusionItem = (index: number) => {
    updateField('exclusions', (value.exclusions ?? []).filter((_, i) => i !== index));
  };

  const submit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    setPageError('');

    if (!validateFields(editorFields, true) || busy || locked) return;

    try {
      if (mode === 'create') {
        const created = await createTour(value).unwrap();
        router.replace(`/agency/tours/${created.id}`);
      } else if (id) {
        await updateTour({ id, body: value }).unwrap();
        router.push(`/agency/tours/${id}`);
      }
    } catch (error) {
      const { fields, hasOtherIssues } = tourEditorServerErrors(error);
      const first = editorFields.find((field) => fields[field]);
      if (first) { setFieldErrors((current) => ({ ...current, ...fields })); setCurrentStep(fieldStep(first) as StepId); }
      if (!first || hasOtherIssues) setPageError(getTourApiMessage(error, 'Không thể lưu tour. Dữ liệu của bạn vẫn còn trên biểu mẫu.'));
    }
  };

  const handleNextFromStep1 = () => {
    setPageError('');
    if (validateFields(['title', 'destination', 'durationDays', 'summary', 'categoryIds'])) setCurrentStep(2);
  };

  const handleNextFromStep2 = () => { setPageError(''); setCurrentStep(3); };

  const handleNextFromStep3 = () => {
    setPageError('');
    if (validateFields(['basePrice', 'maxGroupSize'])) setCurrentStep(4);
  };

  const handleOpenCompleteModal = () => {
    setPageError('');
    if (validateFields(editorFields, true)) setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    setShowCompleteModal(false);
    await submit();
  };

  if (mode === 'edit' && tourLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 text-center" role="status">
        <div className="inline-flex size-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary mb-4" />
        <p className="font-semibold text-slate-700">Đang tải thông tin tour...</p>
      </main>
    );
  }

  if (mode === 'edit' && (tourError || !tour)) {
    return (
      <main className="mx-auto max-w-4xl p-6 text-center">
        <p role="alert" className="text-red-700 font-bold mb-3">
          {getTourApiMessage(tourError, 'Không tìm thấy tour hoặc bạn không có quyền truy cập.')}
        </p>
        <Link className="inline-block rounded-xl bg-primary-container px-4 py-2 text-sm font-semibold text-white" href="/agency/tours">
          Về danh sách tour
        </Link>
      </main>
    );
  }

  // Derive category names for preview
  const selectedCategoryNames = categories
    .filter((c) => value.categoryIds.includes(c.id))
    .map((c) => c.name);

  // Check step completion for timeline ticks
  const isStep1Done = Boolean(value.title.trim().length >= 5 && value.destination.trim() && value.categoryIds.length > 0);
  const isStep2Done = Boolean((value.images ?? []).length > 0);
  const isStep3Done = Boolean(value.basePrice > 0);
  const isStep4Done = Boolean(isStep1Done && isStep2Done && isStep3Done);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Status */}
      {tour && (
        <div className="mb-4 flex justify-end">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
            Trạng thái: {tour.status}
          </span>
        </div>
      )}

      {/* Page Title */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {mode === 'create' ? 'Tạo tour mới' : 'Chỉnh sửa tour'}
          </h1>
        </div>

        {/* Mobile preview toggle */}
        <button
          type="button"
          onClick={() => setShowMobilePreview(!showMobilePreview)}
          className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800"
        >
          <Eye size={18} aria-hidden="true" />
          <span>{showMobilePreview ? 'Ẩn xem trước' : 'Xem trước khách hàng'}</span>
        </button>
      </div>

      {locked && (
        <p className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-semibold text-amber-900">
          Tour đang trong quá trình kiểm duyệt nên tạm khóa chỉnh sửa thông tin.
        </p>
      )}

      {/* Main 2-column layout: Left = Form with Timeline Stepper, Right = Live Preview */}
      <form onSubmit={submit} noValidate className={editorStyles.form}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: TIMELINE STEPPER + CURRENT STEP FORM                         */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6">

            <AgencyTourStepper active={currentStep} onChange={(step) => setCurrentStep(step as StepId)} steps={STEPS_CONFIG.map((step) => ({ ...step, complete: step.id === 1 ? isStep1Done : step.id === 2 ? isStep2Done : step.id === 3 ? isStep3Done : isStep4Done }))} />

            {/* STEP 1: THÔNG TIN CHUNG */}
            {currentStep === 1 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">1. Thông tin chung hành trình</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Đặt tên thu hút và chọn đúng địa điểm để du khách dễ dàng tìm thấy.</p>
                </div>

                {/* Tour Name */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <label htmlFor={fieldId('title')} className="text-sm font-bold text-slate-800">Tên tour <RequiredMark /></label>
                    <span className="text-xs text-slate-400">{value.title.length}/200 ký tự</span>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={200}
                    {...fieldProps('title')}
                    value={value.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Ví dụ: Cao nguyên đá Hà Giang mùa hoa tam giác mạch 4N3Đ"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 font-medium outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                  />
                  {fieldHint('title')}
                </div>

                {/* Destination & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor={fieldId('destination')} className="text-sm font-bold text-slate-800">Điểm đến chính <RequiredMark /></label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      {...fieldProps('destination')}
                    value={value.destination}
                      onChange={(e) => updateField('destination', e.target.value)}
                      placeholder="Ví dụ: Hà Giang, Lào Cai, Ninh Bình..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                    />
                    {fieldHint('destination')}
                    {/* Quick destinations */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {QUICK_DESTINATIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateField('destination', d)}
                          className="rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={fieldId('durationDays')} className="text-sm font-bold text-slate-800">Thời lượng (Số ngày) <RequiredMark /></label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        required
                        {...fieldProps('durationDays')}
                    value={value.durationDays}
                        onChange={(e) => updateField('durationDays', Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ngày</span>
                    </div>
                    {fieldHint('durationDays')}
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <label htmlFor={fieldId('summary')} className="text-sm font-bold text-slate-800">Tóm tắt ngắn</label>
                    <span className="text-xs text-slate-400">{(value.summary ?? '').length}/500</span>
                  </div>
                  <textarea
                    {...fieldProps('summary')}
                    rows={2}
                    maxLength={500}
                    value={value.summary ?? ''}
                    onChange={(e) => updateField('summary', e.target.value || undefined)}
                    placeholder="Mô tả ngắn gọn 1-2 câu nổi bật về trải nghiệm để du khách nắm bắt ngay."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                  />
                  {fieldHint('summary')}
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  <span id={fieldId('categoryIds')} className="text-sm font-bold text-slate-800 block">
                    Danh mục tour <RequiredMark /> <span className="text-xs font-normal text-slate-500">(chọn từ 1 đến 10)</span>
                  </span>
                  {categoriesLoading ? (
                    <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                  ) : (
                    <div role="group" aria-labelledby={fieldId('categoryIds')} aria-invalid={!!fieldErrors.categoryIds} aria-describedby={fieldErrors.categoryIds ? `${fieldId('categoryIds')}-error` : undefined} className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const selected = value.categoryIds.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            aria-pressed={selected}
                            type="button"
                            onClick={() => {
                              const next = selected 
                                ? value.categoryIds.filter((id) => id !== category.id)
                                : [...value.categoryIds, category.id];
                              updateField('categoryIds', next);
                            }}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                              selected
                                ? 'bg-[#087e8b] text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {selected ? `✓ ${category.name}` : category.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {fieldHint('categoryIds')}
                  {categoriesError && <TourFieldHint id={`${formId}-categories-load-error`} message="Chưa tải được danh mục. Hãy tải lại trang để chọn nhé." />}
                </div>

                {/* Next button: chỉ hiện icon -> */}
                <div className="pt-4 flex justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleNextFromStep1}
                    title="Tiếp tục"
                    aria-label="Tiếp tục"
                    className="inline-flex size-11 items-center justify-center rounded-xl bg-[#087e8b] text-white hover:bg-[#00636e] transition-colors shadow-sm cursor-pointer"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: HÌNH ẢNH & BANNER */}
            {currentStep === 2 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">2. Hình ảnh & Thư viện ảnh tour</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Hình ảnh sắc nét và hấp dẫn giúp tăng đến 70% tỉ lệ khách đặt tour.</p>
                </div>

                {/* Current Images List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-800">
                      Ảnh đã thêm ({(value.images ?? []).length})
                    </span>
                    <span className="text-xs text-slate-500">
                      Ảnh đầu tiên sẽ là ảnh bìa chính
                    </span>
                  </div>

                  {(value.images ?? []).length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/60">
                      <span className="material-symbols-outlined text-4xl text-slate-400">photo_library</span>
                      <p className="mt-2 text-sm font-bold text-slate-700">Chưa có hình ảnh nào cho tour</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Hãy tải ảnh từ máy tính hoặc chọn từ bộ ảnh mẫu gợi ý bên dưới.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(value.images ?? []).map((imgUrl, idx) => (
                        <div key={idx} className="group/item relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                          <img src={imgUrl} alt={`Ảnh tour ${idx + 1}`} className="size-full object-cover" />
                          {idx === 0 && (
                            <span className="absolute top-2 left-2 rounded-md bg-[#087e8b] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                              Ảnh bìa chính
                            </span>
                          )}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            {idx !== 0 && (
                              <button
                                type="button"
                                onClick={() => setPrimaryImage(idx)}
                                title="Đặt làm ảnh bìa"
                                className="rounded-lg bg-white/90 p-2 text-xs font-bold text-slate-800 hover:bg-white shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[16px]">star</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              title="Xóa ảnh này"
                              className="rounded-lg bg-rose-600 p-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
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
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                      isDragging 
                        ? 'border-teal-600 bg-teal-50/70' 
                        : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-100/70 text-teal-700 mb-2.5 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Kéo & thả ảnh vào đây, hoặc
                    </p>
                    <label
                      htmlFor={uploadInputId}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">folder_open</span>
                      <span>Tải ảnh từ máy tính</span>
                    </label>
                    <input 
                      id={uploadInputId}
                      type="file" 
                      accept="image/png,image/jpeg,image/webp" 
                      multiple
                      onChange={handleImageFileUpload} 
                      className="hidden" 
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Hỗ trợ định dạng JPG, PNG, WebP (Tối đa 5MB)
                    </p>
                  </div>

                  {/* Thêm ảnh qua đường link ảnh */}
                  <div className="pt-1">
                    {!showUrlInput ? (
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">link</span>
                        <span>+ Thêm ảnh qua đường link ảnh</span>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-900 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">link</span>
                            Dán đường link ảnh
                          </span>
                          <button
                            type="button"
                            onClick={() => { setShowUrlInput(false); setCustomImageUrl(''); }}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Đóng
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="url"
                            value={customImageUrl}
                            onChange={(e) => setCustomImageUrl(e.target.value)}
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

                <TourFieldHint id={`${formId}-images-error`} message={imageError} />
                {/* Quick Presets */}
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Gợi ý hình ảnh chất lượng cao theo điểm đến:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_PHOTOS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => updateField('images', [...(value.images ?? []), preset.url])}
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

                {/* Stepper Navigation Buttons: 2 button <- và -> */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    title="Quay lại"
                    aria-label="Quay lại"
                    className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep2}
                    title="Tiếp tục"
                    aria-label="Tiếp tục"
                    className="inline-flex size-11 items-center justify-center rounded-xl bg-[#087e8b] text-white hover:bg-[#00636e] transition-colors shadow-sm cursor-pointer"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GIÁ & DỊCH VỤ */}
            {currentStep === 3 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">3. Giá tiền & Dịch vụ trọn gói</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Quy định giá cơ bản và các quyền lợi đi kèm minh bạch cho du khách.</p>
                </div>

                {/* Base price & Max group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor={fieldId('basePrice')} className="text-sm font-bold text-slate-800">Giá cơ bản (VND) <RequiredMark /></label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100000000000}
                        required
                        {...fieldProps('basePrice')}
                    value={value.basePrice}
                        onChange={(e) => updateField('basePrice', Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-[#087e8b] outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₫</span>
                    </div>
                    {fieldHint('basePrice')}
                    <span className="block text-xs font-semibold text-teal-700">
                      Hiển thị: {new Intl.NumberFormat('vi-VN').format(value.basePrice || 0)} ₫ / khách
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={fieldId('maxGroupSize')} className="text-sm font-bold text-slate-800">Số khách tối đa / đoàn</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        {...fieldProps('maxGroupSize')}
                    value={value.maxGroupSize ?? ''}
                        onChange={(e) => updateField('maxGroupSize', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Ví dụ: 25"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">khách</span>
                    </div>
                    {fieldHint('maxGroupSize')}
                  </div>
                </div>

                {/* Inclusions */}
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-800 block">Dịch vụ bao gồm</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInclusion}
                      onChange={(e) => setCustomInclusion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addInclusionItem(customInclusion);
                          setCustomInclusion('');
                        }
                      }}
                      placeholder="Nhập dịch vụ bao gồm rồi bấm Thêm..."
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#087e8b]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addInclusionItem(customInclusion);
                        setCustomInclusion('');
                      }}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      + Thêm
                    </button>
                  </div>

                  {/* Added inclusions list */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(value.inclusions ?? []).map((item, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-800">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        <span>{item}</span>
                        <button type="button" onClick={() => removeInclusionItem(idx)} className="text-teal-600 hover:text-rose-600">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Quick default inclusions */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">Gợi ý nhanh tiện ích:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_INCLUSIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => addInclusionItem(item)}
                          className="rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Exclusions */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  <label className="text-sm font-bold text-slate-800 block">Dịch vụ không bao gồm</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customExclusion}
                      onChange={(e) => setCustomExclusion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addExclusionItem(customExclusion);
                          setCustomExclusion('');
                        }
                      }}
                      placeholder="Nhập dịch vụ loại trừ..."
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#087e8b]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addExclusionItem(customExclusion);
                        setCustomExclusion('');
                      }}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900"
                    >
                      + Thêm
                    </button>
                  </div>

                  {/* Added exclusions list */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(value.exclusions ?? []).map((item, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        <span className="material-symbols-outlined text-[14px] text-slate-400">close</span>
                        <span>{item}</span>
                        <button type="button" onClick={() => removeExclusionItem(idx)} className="text-slate-500 hover:text-rose-600">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Quick default exclusions */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">Gợi ý mục loại trừ:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_EXCLUSIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => addExclusionItem(item)}
                          className="rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stepper Navigation Buttons: 2 button <- và -> */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    title="Quay lại"
                    aria-label="Quay lại"
                    className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep3}
                    title="Tiếp tục"
                    aria-label="Tiếp tục"
                    className="inline-flex size-11 items-center justify-center rounded-xl bg-[#087e8b] text-white hover:bg-[#00636e] transition-colors shadow-sm cursor-pointer"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: TOUR GUIDE & HOÀN TẤT */}
            {currentStep === 4 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-slate-900">4. Hoàn tất</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kiểm tra thông tin trước khi lưu và xuất bản tour lên hệ thống.</p>
                </div>

                {/* Guide Assignment Status */}
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                    Hướng dẫn viên phụ trách
                  </span>
                  {tour?.guide ? (
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-teal-600 text-white font-bold">
                        {tour.guide.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tour.guide.fullName}</p>
                        <p className="text-xs text-slate-500">Đã được phân công phụ trách tour này</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">person_off</span>
                        <p className="text-sm font-semibold text-slate-700">Chưa phân công hướng dẫn viên</p>
                      </div>
                      {id && (
                        <Link 
                          href={`/agency/tours/${id}`}
                          className="rounded-xl border border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-teal-50"
                        >
                          Phân công trong trang Quản lý
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Checklist Summary */}
                <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800 block mb-2">
                    Checklist sẵn sàng xuất bản:
                  </span>
                  <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                    <p className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] ${value.title ? 'text-emerald-600' : 'text-slate-300'}`}>check_circle</span>
                      <span>Tên tour & điểm đến: <strong>{value.destination || 'Chưa có'}</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] ${(value.images ?? []).length > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>check_circle</span>
                      <span>Hình ảnh thương hiệu: <strong>{(value.images ?? []).length} ảnh</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] ${value.basePrice > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>check_circle</span>
                      <span>Giá cơ bản niêm yết: <strong>{new Intl.NumberFormat('vi-VN').format(value.basePrice)} ₫</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] ${value.categoryIds.length > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>check_circle</span>
                      <span>Danh mục: <strong>{value.categoryIds.length} danh mục</strong></span>
                    </p>
                  </div>
                </div>

                {/* Final Form Navigation: 2 button <- và Hoàn thiện */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    title="Quay lại"
                    aria-label="Quay lại"
                    className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCompleteModal}
                    disabled={busy || categoriesLoading || locked || !!categoriesError}
                    className="rounded-xl bg-[#087e8b] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#00636e] transition-colors disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-[#087e8b]/20 cursor-pointer"
                  >
                    {busy ? 'Đang lưu...' : 'Hoàn thiện'}
                  </button>
                </div>
              </div>
            )}

            <TourFieldHint id={`${formId}-save-error`} message={pageError} />
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: STICKY REAL-TIME LIVE PREVIEW                               */}
          {/* ========================================================================= */}
          <div className={`min-w-0 lg:sticky lg:top-6 lg:col-span-5 xl:col-span-5 ${showMobilePreview ? 'block' : 'hidden lg:block'}`}>
            <AgencyTourLivePreview
              title={value.title}
              destination={value.destination}
              durationDays={value.durationDays}
              basePrice={value.basePrice}
              images={value.images ?? []}
              summary={value.summary}
              inclusions={value.inclusions ?? []}
              categoryNames={selectedCategoryNames}
              guide={tour?.guide}
            />
          </div>

        </div>

        {/* ========================================================================= */}
        {/* COMPLETE CONFIRMATION MODAL                                              */}
        {/* ========================================================================= */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-200/60 shrink-0">
                  <span className="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">
                    Bạn có chắc chắn muốn hoàn thiện?
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Tour: <span className="font-semibold text-slate-700">{value.title || 'Tour mới'}</span>
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                Thông tin tour sẽ được lưu và cập nhật lên hệ thống. Bạn có chắc chắn muốn hoàn tất các bước thiết lập?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                {/* Nút Huỷ bỏ (tức chưa xong): Chữ trắng nền xanh giống nút Huỷ khi bấm Lưu trữ */}
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  disabled={busy}
                  className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
                >
                  Huỷ bỏ
                </button>

                {/* Nút Tiếp tục / Xác nhận: Chữ xanh viền trắng giống nút Tiếp tục khi bấm Lưu trữ */}
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  disabled={busy}
                  className="rounded-xl border border-teal-600 bg-white px-5 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                >
                  {busy ? 'Đang lưu...' : 'Tiếp tục'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
