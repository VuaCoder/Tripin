'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Images, X } from 'lucide-react';
import { validateImageFile } from '@/features/traveler-account/api/avatarUpload';

function Preview({ file, remove, disabled }: { file: File; remove: () => void; disabled: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <div className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url && <img src={url} alt={`Xem trước ${file.name}`} className="h-full w-full object-cover" />}
    <button type="button" onClick={remove} disabled={disabled} aria-label={`Xóa ảnh ${file.name}`} className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"><X size={16} /></button>
    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-slate-950/65 px-2 py-1.5 text-[11px] text-white">{file.name}</span>
  </div>;
}

export function ReviewPhotoPicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled: boolean }) {
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const addFiles = (selected: File[]) => {
    if (disabled) return;
    const next = [...files];
    const messages: string[] = [];
    for (const file of selected) {
      const issue = validateImageFile(file, 'Ảnh đánh giá');
      if (issue) { messages.push(issue); continue; }
      if (next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue;
      if (next.length === 6) { messages.push('Bạn chỉ có thể thêm tối đa 6 ảnh.'); break; }
      next.push(file);
    }
    onChange(next);
    setError(Array.from(new Set(messages)).join(' '));
  };
  return <section aria-labelledby={`${id}-heading`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <h3 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Images size={17} className="text-brand-tealLight" aria-hidden="true" />Ảnh chuyến đi <span className="text-xs font-normal text-slate-500">(tùy chọn)</span></h3>
      <span aria-live="polite" className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-teal-800">{files.length}/6 ảnh</span>
    </div>
    <div onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={dragging ? 'rounded-xl bg-teal-50 ring-2 ring-brand-tealLight' : ''}>
      <input ref={input} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Thêm ảnh chuyến đi" aria-describedby={`${id}-hint`} disabled={disabled} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      {files.length === 0 ? <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-label="Chọn ảnh chuyến đi" className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 px-5 py-6 text-center transition hover:border-brand-tealLight hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-tealLight disabled:cursor-wait disabled:opacity-50">
        <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-white text-brand-tealLight"><ImagePlus size={23} aria-hidden="true" /></span>
        <span className="text-sm font-semibold text-brand-teal">Thêm khoảnh khắc từ chuyến đi</span>
        <span className="text-xs leading-relaxed text-slate-600">Chọn ảnh hoặc kéo thả ảnh vào đây</span>
      </button> : <div className="grid grid-cols-3 gap-2.5">
        {files.map((file, index) => <Preview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} remove={() => { onChange(files.filter((_, i) => i !== index)); setError(''); }} disabled={disabled} />)}
        {files.length < 6 && <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-label="Chọn thêm ảnh chuyến đi" className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 text-brand-teal transition hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-tealLight disabled:opacity-50"><ImagePlus size={24} aria-hidden="true" /><span className="text-xs font-semibold">Thêm ảnh</span></button>}
      </div>}
    </div>
    <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">JPG, PNG hoặc WebP · Tối đa 5 MB/ảnh. Chia sẻ ảnh cảnh đẹp, lịch trình hay dịch vụ bạn đã trải nghiệm.</p>
    {error && <p className="text-xs font-medium text-red-700" role="alert">{error}</p>}
  </section>;
}
