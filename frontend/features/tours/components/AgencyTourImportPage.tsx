'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { getTourApiMessage, useExtractAgencyTourDocumentMutation, useGetTourCategoriesQuery, useImportAgencyToursMutation } from '../api/toursApi';
import type { ExtractedTourCandidate, TourContentInput } from '../types';
import { TourContentFields } from './TourContentFields';

function asEditable(candidate: ExtractedTourCandidate = {}): TourContentInput {
  return {
    title: candidate.title ?? '', summary: candidate.summary, description: candidate.description,
    destination: candidate.destination ?? '', durationDays: candidate.durationDays ?? 1,
    basePrice: candidate.basePrice ?? 0, maxGroupSize: candidate.maxGroupSize,
    categoryIds: candidate.categoryIds ?? [], images: candidate.images ?? [],
    inclusions: candidate.inclusions ?? [], exclusions: candidate.exclusions ?? [],
  };
}

export function AgencyTourImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: categories = [], error: categoryError } = useGetTourCategoriesQuery();
  const [extract, extractState] = useExtractAgencyTourDocumentMutation();
  const [importTours, importState] = useImportAgencyToursMutation();
  const [drafts, setDrafts] = useState<TourContentInput[]>([]);
  const [errorText, setErrorText] = useState('');
  const [success, setSuccess] = useState('');

  const extractFile = async (file?: File) => {
    if (!file) return;
    setErrorText(''); setSuccess('');
    if (!/\.(docx|pdf)$/i.test(file.name)) { setErrorText('Chỉ hỗ trợ file DOCX hoặc PDF có thể chọn văn bản.'); return; }
    try {
      const response = await extract(file).unwrap();
      setDrafts(response.tours.map(asEditable));
    } catch (error) { setErrorText(getTourApiMessage(error, 'Không thể đọc tài liệu. Bạn có thể nhập tour thủ công.')); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const addManual = () => { setErrorText(''); setSuccess(''); setDrafts((current) => current.length >= 50 ? current : [...current, asEditable()]); };
  const submit = async () => {
    setErrorText(''); setSuccess('');
    if (!drafts.length) { setErrorText('Hãy thêm ít nhất một tour.'); return; }
    const invalid = drafts.findIndex((tour) => tour.title.trim().length < 5 || !tour.destination.trim() || tour.durationDays < 1 || !Number.isInteger(tour.basePrice) || tour.basePrice < 0 || tour.categoryIds.length === 0 || tour.categoryIds.length > 10);
    if (invalid >= 0) { setErrorText(`Tour số ${invalid + 1} còn thiếu hoặc sai thông tin bắt buộc. Hãy hoàn thiện tên, điểm đến, thời lượng, giá và danh mục.`); return; }
    try {
      const result = await importTours(drafts).unwrap();
      setSuccess(`Đã tạo ${result.created} tour ở trạng thái bản nháp.`);
      setDrafts([]);
      window.setTimeout(() => router.push('/agency/tours'), 900);
    } catch (error) { setErrorText(getTourApiMessage(error, 'Không thể nhập các tour. Hãy kiểm tra lại dữ liệu; chưa có thông báo thành công từ máy chủ.')); }
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6 mt-4"><h1 className="text-2xl font-bold tracking-tight text-slate-900">Nhập nhiều tour</h1><p className="mt-1 text-sm text-slate-600">Tối đa 50 tour mỗi lần. Tất cả tour được tạo thành bản nháp và cần gửi duyệt riêng.</p></div>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Đọc từ tài liệu</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Chọn DOCX hoặc PDF có lớp văn bản (tối đa 10 MB, PDF tối đa 40 trang). Văn bản sẽ được gửi tới AI provider đang cấu hình để tạo bản nháp; hệ thống không lưu tài liệu. PDF scan không hỗ trợ OCR.</p>
      <input ref={fileRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => void extractFile(e.target.files?.[0])} className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2.5 file:font-semibold file:text-primary hover:file:bg-teal-100" />
      {extractState.isLoading && <p className="mt-3 text-sm text-slate-600" role="status">Đang trích xuất tài liệu…</p>}
      {!extractState.isLoading && extractState.error && <p className="mt-3 text-sm text-amber-800">Không trích được bằng AI. Bạn vẫn có thể nhập thủ công.</p>}
    </section>
    <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div><h2 className="font-bold text-slate-900">Nhập thủ công</h2><p className="mt-1 text-sm text-slate-600">Thêm từng tour rồi điền thông tin theo mẫu.</p></div>
      <button type="button" onClick={addManual} disabled={drafts.length >= 50} className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">+ Thêm tour</button>
    </section>
    {categoryError && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Không tải được danh mục. Vui lòng tải lại trang trước khi xác nhận.</p>}
    {errorText && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{errorText}</p>}
    {success && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    {drafts.length > 0 && <div className="space-y-5">
      {drafts.map((draft, index) => <section key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Tour {index + 1}</h2><p className="text-xs text-slate-500">{draft.title ? 'Hãy kiểm tra và sửa lại dữ liệu trích xuất.' : 'Hoàn thiện các trường bắt buộc.'}</p></div><button type="button" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Xóa khỏi lô</button></div><TourContentFields value={draft} onChange={(next) => setDrafts((current) => current.map((item, i) => i === index ? next : item))} categories={categories} /></section>)}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-4 backdrop-blur-sm"><span className="text-sm text-slate-600">{drafts.length}/50 tour · Chỉ lưu sau khi bạn xác nhận</span><button type="button" onClick={() => void submit()} disabled={importState.isLoading || !!categoryError || !categories.length} className="rounded-lg bg-primary-container px-5 py-3 text-sm font-bold text-white hover:bg-primary disabled:opacity-50">{importState.isLoading ? 'Đang nhập…' : `Xác nhận nhập ${drafts.length} tour`}</button></div>
    </div>}
  </main>;
}
