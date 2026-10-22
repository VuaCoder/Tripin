'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { uploadImageToCloudinary } from '@/features/traveler-account/api/avatarUpload';
import { COMPLAINT_TAXONOMY, PRIORITY_LABELS } from '../labels';
import type { ComplaintTicketCategory, ComplaintTicketPriority, CreateComplaintTicketInput } from '../types';
import {
  useCreateComplaintImageSignatureMutation,
  useCreateComplaintTicketMutation,
} from '../api/complaintsApi';
import { ComplaintPhotoPicker } from './ComplaintPhotoPicker';

interface ComplaintTicketDialogProps {
  open: boolean;
  tourId: string;
  tourTitle?: string;
  bookingId?: string;
  bookingCode?: string;
  onClose: () => void;
  onSuccess?: (ticketCode: string) => void;
}

export function ComplaintTicketDialog({
  open,
  tourId,
  tourTitle = 'Tour du lịch',
  bookingId,
  bookingCode,
  onClose,
  onSuccess,
}: ComplaintTicketDialogProps) {
  const [category, setCategory] = useState<ComplaintTicketCategory>(COMPLAINT_TAXONOMY[0].id);
  const [subCategory, setSubCategory] = useState<string>(COMPLAINT_TAXONOMY[0].subCategories[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [createSignature] = useCreateComplaintImageSignatureMutation();
  const [createTicket, { isLoading }] = useCreateComplaintTicketMutation();

  const busy = isLoading || uploading;

  const currentCategoryGroup = COMPLAINT_TAXONOMY.find((c) => c.id === category) ?? COMPLAINT_TAXONOMY[0];
  const currentSub = currentCategoryGroup.subCategories.find((s) => s.id === subCategory);
  const priority: ComplaintTicketPriority =
    category === 'SAFETY_URGENT' ? 'URGENT' : currentSub?.defaultPriority ?? 'NORMAL';

  useEffect(() => {
    if (!open) return;
    setCategory(COMPLAINT_TAXONOMY[0].id);
    setSubCategory(COMPLAINT_TAXONOMY[0].subCategories[0]?.id || '');
    setSubject('');
    setDescription('');
    setFiles([]);
    setUploading(false);
    setUploadProgress('');
    setError(null);
    setServerError(null);
  }, [open, tourId]);

  const handleCategoryChange = (catId: ComplaintTicketCategory) => {
    setCategory(catId);
    const group = COMPLAINT_TAXONOMY.find((c) => c.id === catId);
    if (group && group.subCategories[0]) {
      setSubCategory(group.subCategories[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setServerError(null);

    if (subject.trim().length < 5) {
      setError('Vui lòng nhập tiêu đề tóm tắt (ít nhất 5 ký tự).');
      return;
    }
    if (description.trim().length < 10) {
      setError('Vui lòng mô tả chi tiết vấn đề (ít nhất 10 ký tự).');
      return;
    }

    try {
      let imagePublicIds: string[] | undefined;

      if (files.length > 0) {
        setUploading(true);
        const ids: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          setUploadProgress(`Đang tải ảnh ${i + 1}/${files.length} lên Cloudinary...`);
          const sig = await createSignature({ role: 'TRAVELER' }).unwrap();
          const uploadRes = await uploadImageToCloudinary(file, sig);
          ids.push(uploadRes.publicId);
        }
        imagePublicIds = ids;
      }

      setUploadProgress('Đang gửi phiếu khiếu nại...');
      const input: CreateComplaintTicketInput = {
        tourId,
        bookingId: bookingId || undefined,
        category,
        subCategory,
        subject: subject.trim(),
        description: description.trim(),
        imagePublicIds,
      };
      const result = await createTicket(input).unwrap();
      onSuccess?.(result.ticketCode);
      onClose();
    } catch (err: any) {
      setServerError(
        err?.message ||
          err?.data?.error?.message ||
          'Không thể mở phiếu khiếu nại lúc này. Vui lòng kiểm tra lại kết nối.',
      );
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!busy}
      title="Mở phiếu khiếu nại dịch vụ tour"
      className="max-h-[90vh] max-w-xl overflow-y-auto"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 text-sm">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
          <p className="font-semibold text-slate-900">
            Tour: <span className="text-brand-teal">{tourTitle}</span>
          </p>
          {bookingCode && (
            <p className="mt-0.5 text-xs text-slate-500">
              Mã đặt tour liên quan: <span className="font-mono font-semibold text-slate-700">{bookingCode}</span>
            </p>
          )}
        </div>

        {/* Cấp 1: Nhóm vấn đề chính */}
        <div className="space-y-1">
          <label htmlFor="complaint-category" className="block text-sm font-bold text-slate-700">
            1. Nhóm vấn đề chính
          </label>
          <select
            id="complaint-category"
            value={category}
            disabled={busy}
            onChange={(e) => handleCategoryChange(e.target.value as ComplaintTicketCategory)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          >
            {COMPLAINT_TAXONOMY.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cấp 2: Vấn đề chi tiết */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="complaint-subcategory" className="block text-sm font-bold text-slate-700">
              2. Vấn đề chi tiết
            </label>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_LABELS[priority].className}`}>
              {PRIORITY_LABELS[priority].label}
            </span>
          </div>
          <select
            id="complaint-subcategory"
            value={subCategory}
            disabled={busy}
            onChange={(e) => setSubCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          >
            {currentCategoryGroup.subCategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tiêu đề tóm tắt */}
        <div className="space-y-1">
          <label htmlFor="complaint-subject" className="block text-sm font-bold text-slate-700">
            Tiêu đề tóm tắt
          </label>
          <input
            id="complaint-subject"
            type="text"
            maxLength={200}
            value={subject}
            disabled={busy}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ví dụ: Xe đón trễ 45 phút không liên lạc được"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          />
        </div>

        {/* Mô tả chi tiết */}
        <div className="space-y-1">
          <label htmlFor="complaint-description" className="block text-sm font-bold text-slate-700">
            Mô tả chi tiết sự việc
          </label>
          <textarea
            id="complaint-description"
            rows={4}
            maxLength={4000}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả cụ thể thời gian, địa điểm, sự việc phát sinh và mong muốn bồi thường/hỗ trợ của bạn..."
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          />
        </div>

        {/* Bằng chứng thực tế qua Cloudinary (Không dùng dán link url) */}
        <ComplaintPhotoPicker
          files={files}
          onChange={setFiles}
          disabled={busy}
          maxFiles={5}
        />

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" loading={busy} loadingLabel={uploadProgress || 'Đang gửi...'}>
            Gửi phiếu khiếu nại
          </Button>
        </div>
      </form>
    </Modal>
  );
}
