'use client';

import { useEffect, useState, useId, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, CheckCircle2, X, AlertTriangle, UserX } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  useCreateAgencyTourMutation, 
  useGetAgencyTourQuery, 
  useGetTourCategoriesQuery, 
  useUpdateAgencyTourMutation, 
  useUploadAgencyTourImageMutation,
  getTourApiMessage 
} from '../api/toursApi';
import type { TourContentInput } from '../types';
import { AgencyTourLivePreview } from './AgencyTourLivePreview';
import { TourFieldHint } from './TourFieldHint';
import { TourPolicyFields } from './TourPolicyFields';
import { TourAgePricingFields } from './TourAgePricingFields';
import { TourDestinationCombobox } from './TourDestinationCombobox';
import { TourCategoryCombobox } from './TourCategoryCombobox';
import { TourItemCombobox } from './TourItemCombobox';
import { editorFields, fieldStep, validateTourEditor, tourEditorServerErrors, type EditorField, type EditorErrors } from './tourEditorValidation';
import { formatCurrencyVndInput, parseCurrencyVndInput } from '../utils';
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

function serializeForm(val: TourContentInput): string {
  return JSON.stringify({
    title: (val.title || '').trim(),
    summary: (val.summary || '').trim(),
    description: (val.description || '').trim(),
    destination: (val.destination || '').trim(),
    durationDays: Number(val.durationDays) || 1,
    basePrice: Number(val.basePrice) || 0,
    maxGroupSize: val.maxGroupSize !== undefined && val.maxGroupSize !== null ? Number(val.maxGroupSize) : undefined,
    categoryIds: [...(val.categoryIds || [])].sort(),
    images: [...(val.images || [])],
    inclusions: [...(val.inclusions || [])],
    exclusions: [...(val.exclusions || [])],
    agePricing: val.agePricing || null,
    childPricingPolicy: (val.childPricingPolicy || '').trim(),
    cancellationPolicy: (val.cancellationPolicy || '').trim(),
    travelNotes: (val.travelNotes || '').trim(),
    requiredDocuments: (val.requiredDocuments || '').trim(),
  });
}

// Preset high quality photos for quick 1-click branding
const PRESET_PHOTOS = [
  { label: 'Hà Giang Mùa Hoa', url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80' },
  { label: 'Sapa Mây Ngàn', url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80' },
  { label: 'Vịnh Hạ Long', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
  { label: 'Tràng An Ninh Bình', url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80' },
  { label: 'Phố Cổ Hội An', url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80' },
];

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

export function AgencyTourEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const params = useParams<{ id: string }>();
  const id = mode === 'edit' ? params.id : undefined;
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams?.get('from') || '';
  const defaultExitUrl = fromUrl || '/agency/tours';
  const { data: tour, isLoading: tourLoading, error: tourError } = useGetAgencyTourQuery(id ?? '', { skip: !id });
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useGetTourCategoriesQuery();
  const [createTour, createState] = useCreateAgencyTourMutation();
  const [updateTour, updateState] = useUpdateAgencyTourMutation();
  const [uploadTourImage, uploadState] = useUploadAgencyTourImageMutation();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [value, setValue] = useState<TourContentInput>(emptyForm);
  const [pageError, setPageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<EditorErrors>({});
  const formId = useId();
  const fieldId = (field: EditorField) => `${formId}-${field}`;
  const fieldHint = (field: EditorField) => <TourFieldHint id={`${fieldId(field)}-error`} message={fieldErrors[field]} />;
  const fieldProps = (field: EditorField) => ({ 
    id: fieldId(field), 
    'aria-invalid': !!fieldErrors[field], 
    'aria-describedby': fieldErrors[field] ? `${fieldId(field)}-error` : undefined, 
    onBlur: () => setFieldErrors((current) => ({ ...current, [field]: validateTourEditor(value)[field] })) 
  });

  const [currentStep, setCurrentStep] = useState<StepId>(1);

  // Sub-states for Step 2 (Images) and Step 3 (Inclusions/Exclusions)
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [pendingExitUrl, setPendingExitUrl] = useState<string>('');
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const uploadInputId = useId();

  useEffect(() => {
    setInitialSnapshot('');
  }, [id]);

  useEffect(() => {
    if (tour && !initialSnapshot) {
      const initial: TourContentInput = {
        title: tour.title ?? '',
        summary: tour.summary ?? '',
        description: tour.description ?? '',
        destination: tour.destination ?? '',
        durationDays: tour.durationDays ?? 1,
        basePrice: tour.basePrice ?? 0,
        maxGroupSize: tour.maxGroupSize,
        categoryIds: tour.categoryIds ? [...tour.categoryIds].sort() : [],
        images: tour.images && tour.images.length > 0 ? [...tour.images] : (tour.coverImage ? [tour.coverImage] : []),
        inclusions: tour.inclusions ? [...tour.inclusions] : [],
        exclusions: tour.exclusions ? [...tour.exclusions] : [],
        agePricing: tour.agePricing ?? null,
        childPricingPolicy: tour.childPricingPolicy ?? '',
        cancellationPolicy: tour.cancellationPolicy ?? '',
        travelNotes: tour.travelNotes ?? '',
        requiredDocuments: tour.requiredDocuments ?? '',
      };
      setValue(initial);
      setInitialSnapshot(serializeForm(initial));
    }
  }, [tour, initialSnapshot]);

  const isDirty = useMemo(() => {
    if (mode === 'create') {
      return Boolean(
        value.title.trim() ||
        value.destination.trim() ||
        value.basePrice > 0 ||
        (value.images && value.images.length > 0) ||
        value.categoryIds.length > 0 ||
        value.summary?.trim() ||
        value.description?.trim()
      );
    }
    if (!initialSnapshot) return false;
    return serializeForm(value) !== initialSnapshot;
  }, [mode, value, initialSnapshot]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const busy = createState.isLoading || updateState.isLoading || isUploadingImage || uploadState.isLoading;
  const locked = tour?.status === 'PENDING_REVIEW';

  const updateField = <K extends keyof TourContentInput>(key: K, nextVal: TourContentInput[K]) => {
    setValue((prev) => ({ ...prev, [key]: nextVal }));
    if (editorFields.includes(key as EditorField)) {
      setFieldErrors((current) => current[key as EditorField] ? { ...current, [key]: validateTourEditor({ ...value, [key]: nextVal })[key as EditorField] } : current);
    }
  };

  const validateFields = (fields: readonly EditorField[], jump = false) => {
    const errors = validateTourEditor(value);
    setFieldErrors((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, errors[field]])) }));
    const first = fields.find((field) => errors[field]);
    if (first && jump) {
      const stepNum = fieldStep(first) as StepId;
      setCurrentStep(stepNum);
      const targetEl = document.getElementById(fieldId(first)) || document.getElementById(`tour-section-${stepNum}`);
      if (targetEl) {
        targetEl.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        targetEl.focus?.();
      }
    }
    return !first;
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

  const processImageFiles = async (files: FileList | File[]) => {
    setImageError('');
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!validFiles.length) {
      setImageError('Hãy chọn tệp ảnh JPG, PNG hoặc WebP nhé.');
      return;
    }
    for (const file of validFiles) {
      if (file.size > 5 * 1024 * 1024) {
        setImageError(`Ảnh “${file.name}” quá lớn. Hãy chọn ảnh không quá 5 MB nhé.`);
        return;
      }
    }
    setIsUploadingImage(true);
    try {
      for (const file of validFiles) {
        const res = await uploadTourImage(file).unwrap();
        if (res.url) {
          setValue((prev) => ({
            ...prev,
            images: [...(prev.images ?? []), res.url],
          }));
        }
      }
    } catch (err) {
      setImageError(getTourApiMessage(err, 'Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.'));
    } finally {
      setIsUploadingImage(false);
    }
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

  const saveTourPayload = async (destinationUrl?: string): Promise<boolean> => {
    setPageError('');
    if (!validateFields(editorFields, true) || busy || locked) return false;

    const sanitizedImages = (value.images ?? []).filter((img) => img.startsWith('http://') || img.startsWith('https://'));
    const payload: TourContentInput = {
      ...value,
      images: sanitizedImages,
    };

    try {
      if (mode === 'create') {
        const created = await createTour(payload).unwrap();
        router.replace(destinationUrl || `/agency/tours/${created.id}`);
        return true;
      } else if (id) {
        await updateTour({ id, body: payload }).unwrap();
        router.push(destinationUrl || defaultExitUrl);
        return true;
      }
      return false;
    } catch (error) {
      const { fields, hasOtherIssues } = tourEditorServerErrors(error);
      const first = editorFields.find((field) => fields[field]);
      if (first) { 
        setFieldErrors((current) => ({ ...current, ...fields })); 
        setCurrentStep(fieldStep(first) as StepId);
        const targetEl = document.getElementById(fieldId(first));
        if (targetEl) {
          targetEl.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          targetEl.focus?.();
        }
      }
      if (!first || hasOtherIssues) setPageError(getTourApiMessage(error, 'Không thể lưu tour. Dữ liệu của bạn vẫn còn trên biểu mẫu.'));
      return false;
    }
  };

  const submit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (mode === 'edit' && !isDirty) return;
    await saveTourPayload();
  };

  const handleRequestExit = (targetHref?: string) => {
    const destination = targetHref || defaultExitUrl;
    if (!isDirty) {
      router.push(destination);
      return;
    }
    setPendingExitUrl(destination);
    setShowExitConfirmModal(true);
  };

  const handleCancelExit = () => {
    setShowExitConfirmModal(false);
  };

  const handleExitWithoutSave = () => {
    setShowExitConfirmModal(false);
    router.push(pendingExitUrl || defaultExitUrl);
  };

  const handleSaveAndExit = async () => {
    const destination = pendingExitUrl || defaultExitUrl;
    const ok = await saveTourPayload(destination);
    if (ok) {
      setShowExitConfirmModal(false);
    }
  };

  const handleOpenCompleteModal = () => {
    setPageError('');
    if (mode === 'edit' && !isDirty) {
      setPageError('Nội dung và thông tin tour chưa có thay đổi nào để lưu.');
      return;
    }
    if (validateFields(editorFields, true)) {
      setShowCompleteModal(true);
    }
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

      {/* Page Title & Quick Action Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <button
              type="button"
              onClick={() => handleRequestExit(defaultExitUrl)}
              className="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={14} /> {fromUrl?.startsWith(`/agency/tours/${id}`) ? 'Quản lý tour' : 'Danh sách tour'}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {mode === 'create' ? 'Tạo tour mới' : 'Chỉnh sửa tour'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Điền toàn bộ thông tin hành trình, hình ảnh và giá niêm yết trong một màn hình duy nhất.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick jump to Itinerary & Departures in edit mode */}
          {mode === 'edit' && id && (
            <button
              type="button"
              onClick={() => handleRequestExit(`/agency/tours/${id}`)}
              title="Mở màn hình Quản lý Lịch trình & Khởi hành"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-teal-800 hover:bg-teal-100/80 transition-colors shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px] text-teal-700">calendar_month</span>
              <span>Lịch trình & Khởi hành</span>
            </button>
          )}

          {/* Mobile preview toggle */}
          <button
            type="button"
            onClick={() => setShowMobilePreview(!showMobilePreview)}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800"
          >
            <Eye size={18} aria-hidden="true" />
            <span>{showMobilePreview ? 'Ẩn xem trước' : 'Xem trước khách'}</span>
          </button>

          {/* Cancel button */}
          <button
            type="button"
            onClick={() => handleRequestExit()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
          >
            <X size={16} />
            <span>Hủy</span>
          </button>

          {/* Quick complete / save in header */}
          <button
            type="button"
            onClick={handleOpenCompleteModal}
            disabled={busy || categoriesLoading || locked || !!categoriesError || (mode === 'edit' && !isDirty)}
            title={mode === 'edit' && !isDirty ? 'Nội dung và thông tin chưa có thay đổi nào để lưu' : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#087e8b] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#00636e] transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-600 cursor-pointer"
          >
            <CheckCircle2 size={18} />
            <span>
              {busy ? 'Đang lưu...' : mode === 'edit' ? (!isDirty ? 'Chưa có thay đổi' : 'Lưu thay đổi') : 'Tạo tour & Tiếp tục'}
            </span>
          </button>
        </div>
      </div>

      {locked && (
        <p className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-semibold text-amber-900">
          Tour đang trong quá trình kiểm duyệt nên tạm khóa chỉnh sửa thông tin.
        </p>
      )}

      {/* Main 2-column layout: Left = Form with all 4 sections combined, Right = Live Preview */}
      <form onSubmit={submit} noValidate className={editorStyles.form}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: QUICK ANCHOR STEPPER + ALL 4 FORM SECTIONS                   */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6">

            {/* ===================================================================== */}
            {/* SECTION 1: THÔNG TIN CHUNG HÀNH TRÌNH                                 */}
            {/* ===================================================================== */}
            <section id="tour-section-1" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-5 scroll-mt-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-xs font-black">
                      1
                    </span>
                    Thông tin chung hành trình
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Đặt tên thu hút và chọn đúng địa điểm để du khách dễ dàng tìm thấy.</p>
                </div>
                {isStep1Done && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                    ✓ Đã điền
                  </span>
                )}
              </div>

              {/* Tour Name */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor={fieldId('title')} className="text-sm font-bold text-slate-800">Tên tour</label>
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
                  <label htmlFor={fieldId('destination')} className="text-sm font-bold text-slate-800">
                    Điểm đến chính
                  </label>
                  <TourDestinationCombobox
                    id={fieldId('destination')}
                    required
                    value={value.destination}
                    onChange={(nextDest) => updateField('destination', nextDest)}
                    onBlur={() => setFieldErrors((current) => ({ ...current, destination: validateTourEditor(value).destination }))}
                    aria-invalid={!!fieldErrors.destination}
                    aria-describedby={fieldErrors.destination ? `${fieldId('destination')}-error` : undefined}
                    hint={fieldHint('destination')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={fieldId('durationDays')} className="text-sm font-bold text-slate-800">Thời lượng (Số ngày)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      {...fieldProps('durationDays')}
                      value={value.durationDays}
                      onChange={(e) => updateField('durationDays', Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-14 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">ngày</span>
                  </div>
                  {fieldHint('durationDays')}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label htmlFor={fieldId('summary')} className="text-sm font-bold text-slate-800">
                    Tóm tắt ngắn <span className="text-xs font-normal text-slate-500">(Optional)</span>
                  </label>
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
                  Danh mục tour <span className="text-xs font-normal text-slate-500">(chọn từ 1 đến 10)</span>
                </span>
                <TourCategoryCombobox
                  id={`${formId}-categoryIds`}
                  selectedIds={value.categoryIds}
                  onChange={(next) => updateField('categoryIds', next)}
                  categories={categories}
                  isLoading={categoriesLoading}
                  aria-invalid={!!fieldErrors.categoryIds}
                  aria-describedby={fieldErrors.categoryIds ? `${fieldId('categoryIds')}-error` : undefined}
                  aria-labelledby={fieldId('categoryIds')}
                />
                {fieldHint('categoryIds')}
                {categoriesError && <TourFieldHint id={`${formId}-categories-load-error`} message="Chưa tải được danh mục. Hãy tải lại trang để chọn nhé." />}
              </div>
            </section>

            {/* ===================================================================== */}
            {/* SECTION 2: HÌNH ẢNH & THƯ VIỆN ẢNH TOUR                                */}
            {/* ===================================================================== */}
            <section id="tour-section-2" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6 scroll-mt-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-xs font-black">
                      2
                    </span>
                    Hình ảnh & Thư viện ảnh tour
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Tải ảnh từ máy tính lên Cloudinary hoặc dán liên kết ảnh sắc nét.</p>
                </div>
                {isStep2Done && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                    ✓ {(value.images ?? []).length} ảnh
                  </span>
                )}
              </div>

              {/* Current Images List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-800">
                    Ảnh đã thêm ({(value.images ?? []).length})
                  </span>
                  <span className="text-xs text-slate-500">
                    Ảnh đầu tiên sẽ tự động làm ảnh bìa chính
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
                              className="rounded-lg bg-white/90 p-2 text-xs font-bold text-slate-800 hover:bg-white shadow-sm cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">star</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            title="Xóa ảnh này"
                            className="rounded-lg bg-rose-600 p-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm cursor-pointer"
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
                  {isUploadingImage ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="size-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700 mb-2" />
                      <p className="text-xs font-bold text-teal-800">Đang tải ảnh lên Cloudinary...</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Vui lòng chờ trong giây lát</p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* Thêm ảnh qua đường link ảnh */}
                <div className="pt-1">
                  {!showUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors cursor-pointer"
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
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
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
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
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
                      className="group/p relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-teal-500 transition-all text-left cursor-pointer"
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
            </section>

            {/* ===================================================================== */}
            {/* SECTION 3: GIÁ TIỀN & DỊCH VỤ TRỌN GÓI                                */}
            {/* ===================================================================== */}
            <section id="tour-section-3" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6 scroll-mt-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-xs font-black">
                      3
                    </span>
                    Giá tiền & Dịch vụ trọn gói
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Quy định giá cơ bản và các quyền lợi đi kèm minh bạch cho du khách.</p>
                </div>
                {isStep3Done && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                    ✓ {new Intl.NumberFormat('vi-VN').format(value.basePrice)} ₫
                  </span>
                )}
              </div>

              {/* Base price & Max group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor={fieldId('basePrice')} className="text-sm font-bold text-slate-800">
                    Giá cơ bản (VND)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      {...fieldProps('basePrice')}
                      value={formatCurrencyVndInput(value.basePrice)}
                      onChange={(e) => {
                        const parsed = parseCurrencyVndInput(e.target.value);
                        if (parsed <= 100_000_000_000) {
                          updateField('basePrice', parsed);
                        }
                      }}
                      placeholder="Ví dụ: 1.500.000"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm font-extrabold text-[#087e8b] outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20 tracking-wide font-sans"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">₫</span>
                  </div>
                  {fieldHint('basePrice')}
                  {value.basePrice > 0 && (
                    <span className="block text-xs font-medium text-slate-500">
                      Hiển thị: {new Intl.NumberFormat('vi-VN').format(value.basePrice)} ₫ / khách
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={fieldId('maxGroupSize')} className="text-sm font-bold text-slate-800">
                    Số khách tối đa / đoàn <span className="text-xs font-normal text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      {...fieldProps('maxGroupSize')}
                      value={value.maxGroupSize ?? ''}
                      onChange={(e) => updateField('maxGroupSize', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Ví dụ: 25"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-16 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">khách</span>
                  </div>
                  {fieldHint('maxGroupSize')}
                </div>
              </div>

              {/* Age Pricing & Child Policy */}
              <div id={fieldId('agePricing')} className="space-y-2">
                <TourAgePricingFields value={value} onChange={setValue} />
                {fieldErrors.agePricing && <p role="alert" className="text-sm font-semibold text-red-600">{fieldErrors.agePricing}</p>}
              </div>

              {/* Inclusions & Exclusions 2-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                <TourItemCombobox
                  id={fieldId('inclusions')}
                  label="Dịch vụ bao gồm"
                  placeholder="Tìm kiếm tiện ích hoặc ấn Enter..."
                  items={value.inclusions ?? []}
                  onChange={(items) => updateField('inclusions', items)}
                  suggestions={DEFAULT_INCLUSIONS}
                  tone="positive"
                />

                <TourItemCombobox
                  id={fieldId('exclusions')}
                  label="Dịch vụ không bao gồm"
                  placeholder="Tìm kiếm mục loại trừ hoặc ấn Enter..."
                  items={value.exclusions ?? []}
                  onChange={(items) => updateField('exclusions', items)}
                  suggestions={DEFAULT_EXCLUSIONS}
                  tone="neutral"
                />
              </div>
            </section>

            {/* ===================================================================== */}
            {/* SECTION 4: CHÍNH SÁCH CHUYẾN ĐI & HOÀN TẤT                             */}
            {/* ===================================================================== */}
            <section id="tour-section-4" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6 scroll-mt-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-xs font-black">
                      4
                    </span>
                    Chính sách chuyến đi & Quy định
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Quy định đổi hủy tour, giấy tờ tùy thân và các lưu ý an toàn cho du khách.</p>
                </div>
                {isStep4Done ? (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                    ✓ Sẵn sàng lưu
                  </span>
                ) : null}
              </div>

              <TourPolicyFields value={value} onChange={setValue} includeAgePricing={false} />

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
                      <UserX size={18} className="text-slate-400" />
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
                    <CheckCircle2 size={16} className={value.title ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'} />
                    <span>Tên tour & điểm đến: <strong>{value.destination || 'Chưa có'}</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={(value.images ?? []).length > 0 ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'} />
                    <span>Hình ảnh thương hiệu: <strong>{(value.images ?? []).length} ảnh</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={value.basePrice > 0 ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'} />
                    <span>Giá cơ bản niêm yết: <strong>{new Intl.NumberFormat('vi-VN').format(value.basePrice)} ₫</strong></span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={value.categoryIds.length > 0 ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'} />
                    <span>Danh mục: <strong>{value.categoryIds.length} danh mục</strong></span>
                  </p>
                </div>
              </div>

              {/* Bottom Action Card */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRequestExit()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                >
                  <X size={16} />
                  <span>Hủy</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCompleteModal}
                  disabled={busy || categoriesLoading || locked || !!categoriesError || (mode === 'edit' && !isDirty)}
                  title={mode === 'edit' && !isDirty ? 'Nội dung và thông tin chưa có thay đổi nào để lưu' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#087e8b] px-7 py-3 text-sm font-bold text-white hover:bg-[#00636e] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-600 shadow-lg shadow-[#087e8b]/20 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  <span>
                    {busy ? 'Đang lưu...' : mode === 'edit' ? (!isDirty ? 'Chưa có thay đổi' : 'Lưu thay đổi') : 'Tạo tour & Thiết lập lịch trình'}
                  </span>
                </button>
              </div>
            </section>

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
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-modal-title"
          >
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-200/60 shrink-0">
                  <span className="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <div className="min-w-0">
                  <h3 id="complete-modal-title" className="text-lg font-bold text-slate-900">
                    {mode === 'create' ? 'Xác nhận tạo tour mới?' : 'Xác nhận lưu thay đổi?'}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Tour: <span className="font-semibold text-slate-700">{value.title || 'Tour mới'}</span>
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                {mode === 'create'
                  ? 'Thông tin tour sẽ được lưu và khởi tạo. Tiếp theo bạn sẽ được chuyển đến bước thiết lập chi tiết lịch trình và đợt khởi hành.'
                  : 'Toàn bộ nội dung và thông tin vừa cập nhật sẽ được lưu vào hệ thống.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  Huỷ bỏ
                </button>

                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  disabled={busy}
                  className="rounded-xl bg-[#087e8b] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#00636e] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Đang lưu...' : mode === 'create' ? 'Xác nhận tạo tour' : 'Xác nhận lưu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EXIT CONFIRMATION MODAL (LƯU RỒI THOÁT / THOÁT KHÔNG LƯU / HỦY)          */}
        {/* ========================================================================= */}
        {showExitConfirmModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-modal-title"
          >
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="min-w-0">
                  <h3 id="exit-modal-title" className="text-lg sm:text-xl font-bold text-slate-900">
                    Bạn có thay đổi chưa lưu!
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tour: <span className="font-semibold text-slate-700">{value.title || 'Tour đang chỉnh sửa'}</span>
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Nội dung và thông tin bạn vừa chỉnh sửa chưa được lưu vào hệ thống. Bạn muốn xử lý thế nào trước khi rời khỏi trang này?
              </p>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelExit}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleExitWithoutSave}
                  disabled={busy}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  Thoát không lưu
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExit}
                  disabled={busy}
                  className="rounded-xl bg-[#087e8b] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#00636e] transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {busy ? 'Đang lưu...' : 'Lưu rồi thoát'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
