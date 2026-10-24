'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useSubmitComplaintFeedbackMutation } from '../api/complaintsApi';

interface ComplaintCsatDialogProps {
  open: boolean;
  ticketId: string;
  ticketCode: string;
  agencyName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ComplaintCsatDialog({
  open,
  ticketId,
  ticketCode,
  agencyName = 'Đối tác',
  onClose,
  onSuccess,
}: ComplaintCsatDialogProps) {
  const [rating, setRating] = useState(5);
  const [speedScore, setSpeedScore] = useState(5);
  const [attitudeScore, setAttitudeScore] = useState(5);
  const [satisfactionScore, setSatisfactionScore] = useState(5);
  const [comment, setComment] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const [submitFeedback, { isLoading }] = useSubmitComplaintFeedbackMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    try {
      await submitFeedback({
        ticketId,
        rating,
        speedScore,
        attitudeScore,
        satisfactionScore,
        comment: comment.trim() || undefined,
      }).unwrap();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setServerError(err?.data?.error?.message || 'Không thể gửi đánh giá lúc này. Vui lòng thử lại.');
    }
  };

  const renderStars = (value: number, onChange: (val: number) => void) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            className={`size-6 ${
              star <= value
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-300 hover:text-amber-200'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!isLoading}
      title="Đánh giá chất lượng hỗ trợ"
      className="max-h-[90vh] max-w-lg overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {serverError}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-3.5 text-slate-700">
          <p className="font-semibold text-slate-900">
            Phiếu khiếu nại: <span className="font-mono text-brand-teal">{ticketCode}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Đánh giá của bạn về cách giải quyết của <span className="font-semibold text-slate-700">{agencyName}</span> sẽ được ghi nhận để kiểm duyệt viên quản lý chất lượng dịch vụ sàn.
          </p>
        </div>

        {/* Tổng quan */}
        <div className="space-y-1.5 rounded-xl border border-slate-100 p-3.5">
          <label className="block text-sm font-bold text-slate-800">
            Mức độ hài lòng tổng thể ⭐
          </label>
          <div className="flex items-center justify-between">
            {renderStars(rating, setRating)}
            <span className="text-xs font-bold text-amber-600">
              {rating === 5 ? 'Rất hài lòng' : rating === 4 ? 'Hài lòng' : rating === 3 ? 'Bình thường' : rating === 2 ? 'Không hài lòng' : 'Rất tệ'}
            </span>
          </div>
        </div>

        {/* Tiêu chí phụ */}
        <div className="space-y-3 rounded-xl border border-slate-100 p-3.5 text-xs text-slate-700">
          <p className="font-bold uppercase tracking-wider text-slate-400">Đánh giá theo tiêu chí</p>
          
          <div className="flex items-center justify-between">
            <span>Tốc độ tiếp nhận & xử lý:</span>
            {renderStars(speedScore, setSpeedScore)}
          </div>

          <div className="flex items-center justify-between">
            <span>Thái độ phục vụ & tôn trọng:</span>
            {renderStars(attitudeScore, setAttitudeScore)}
          </div>

          <div className="flex items-center justify-between">
            <span>Mức độ thỏa đáng của giải pháp:</span>
            {renderStars(satisfactionScore, setSatisfactionScore)}
          </div>
        </div>

        {/* Nhận xét */}
        <div className="space-y-1.5">
          <label htmlFor="csat-comment" className="block text-sm font-semibold text-slate-700">
            Nhận xét góp ý (tùy chọn)
          </label>
          <textarea
            id="csat-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isLoading}
            placeholder="Hãy chia sẻ thêm về trải nghiệm giải quyết vấn đề của bạn..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:bg-slate-50"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Bỏ qua
          </Button>
          <Button type="submit" loading={isLoading} loadingLabel="Đang gửi...">
            Gửi đánh giá
          </Button>
        </div>
      </form>
    </Modal>
  );
}
