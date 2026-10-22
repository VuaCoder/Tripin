'use client';

import { useState } from 'react';
import { PlusCircle, Copy, Check } from 'lucide-react';
import { Button, FormField, Input, Modal, Pagination } from '@/components/ui';
import type { PromotionCodeInstance } from '../agency-promotions/types';
import { handlePromotionCodeChange, handlePromotionCodeKeyDown } from './codeHelper';

interface PromotionBatchModalProps {
  open: boolean;
  promotionTitle: string;
  promotionId: string;
  isGenerating: boolean;
  isLoading?: boolean;
  codes: PromotionCodeInstance[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onGenerate: (count: number, prefix: string) => Promise<void>;
  onClose: () => void;
}

export function PromotionBatchModal({
  open,
  promotionTitle,
  isGenerating,
  isLoading,
  codes,
  total,
  page,
  onPageChange,
  onGenerate,
  onClose,
}: PromotionBatchModalProps) {
  const [count, setCount] = useState('10');
  const [prefix, setPrefix] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return;
    setFeedback(null);
    try {
      await onGenerate(n, prefix.trim().toUpperCase());
      setFeedback(`Đã sinh thành công ${n} mã mới!`);
    } catch {
      setFeedback('Không thể sinh mã lúc này. Vui lòng thử lại.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllUnused = () => {
    const unused = codes.filter((c) => !c.isUsed).map((c) => c.code).join('\n');
    if (unused) {
      navigator.clipboard.writeText(unused);
      setFeedback(`Đã sao chép ${codes.filter((c) => !c.isUsed).length} mã chưa dùng vào bộ nhớ tạm!`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdrop={!isGenerating}
      title="Quản lý lô mã khuyến mãi (Unique Codes)"
      className="max-h-[90vh] max-w-4xl overflow-y-auto sm:p-6 lg:p-7"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Khuyến mãi</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{promotionTitle}</p>
          <p className="mt-1 text-xs text-slate-600">
            Tổng cộng: <span className="font-bold text-slate-900">{total}</span> mã đã tạo trong hệ thống. Mỗi mã chỉ dùng được 1 lần.
          </p>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {feedback}
          </div>
        )}

        {/* Generate batch form */}
        <form onSubmit={handleGenerate} className="rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="size-4 text-brand-teal" />
            <span className="text-sm font-bold text-slate-800">Sinh thêm mã mới</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Số lượng mã cần sinh (1–1000)" htmlFor="batch-count" required>
              <Input
                id="batch-count"
                type="number"
                min={1}
                max={1000}
                value={count}
                disabled={isGenerating}
                onChange={(e) => setCount(e.target.value)}
                placeholder="VD: 10"
              />
            </FormField>

            <FormField label="Tiền tố mã (Prefix)" htmlFor="batch-prefix" hint="VD: TET2026 -> TET2026-XXXXXX (khoảng trắng tự chuyển thành _)">
              <Input
                id="batch-prefix"
                value={prefix}
                maxLength={10}
                disabled={isGenerating}
                onChange={(e) => handlePromotionCodeChange(e, setPrefix)}
                onKeyDown={(e) => handlePromotionCodeKeyDown(e, setPrefix)}
                placeholder="VD: TRIP"
              />
            </FormField>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" loading={isGenerating} loadingLabel="Đang sinh mã...">
              Tạo lô mã
            </Button>
          </div>
        </form>

        {/* Code list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800">Danh sách mã ({total})</h4>
            {codes.some((c) => !c.isUsed) && (
              <button
                type="button"
                onClick={copyAllUnused}
                className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Copy className="size-3.5" />
                Sao chép các mã chưa dùng
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500 animate-pulse">
              Đang tải danh sách mã...
            </div>
          ) : codes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Chưa có mã nào trong lô này. Hãy nhập số lượng ở trên và nhấn "Tạo lô mã".
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Mã voucher</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3">Ngày tạo</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.code}</td>
                      <td className="py-2.5 px-3">
                        {item.isUsed ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            Đã dùng
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Chưa dùng
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.code)}
                          className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedCode === item.code ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {copiedCode === item.code ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 20 && (
            <div className="pt-2">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / 20)}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
