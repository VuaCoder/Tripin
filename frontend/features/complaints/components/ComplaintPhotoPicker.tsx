'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Images, X } from 'lucide-react';
import { validateImageFile } from '@/features/traveler-account/api/avatarUpload';

function Preview({
  file,
  remove,
  disabled,
}: {
  file: File;
  remove: () => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={`Xem trước ${file.name}`} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={remove}
        disabled={disabled}
        aria-label={`Xóa ảnh ${file.name}`}
        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-slate-900/75 text-white transition hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
      >
        <X size={14} />
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-slate-950/65 px-2 py-1 text-[11px] text-white">
        {file.name}
      </span>
    </div>
  );
}

interface ComplaintPhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export function ComplaintPhotoPicker({
  files,
  onChange,
  disabled = false,
  maxFiles = 5,
}: ComplaintPhotoPickerProps) {
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const addFiles = (selected: File[]) => {
    if (disabled) return;
    const next = [...files];
    const messages: string[] = [];

    for (const file of selected) {
      const issue = validateImageFile(file, 'Ảnh bằng chứng');
      if (issue) {
        messages.push(issue);
        continue;
      }
      if (
        next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        )
      ) {
        continue;
      }
      if (next.length >= maxFiles) {
        messages.push(`Bạn chỉ có thể tải lên tối đa ${maxFiles} ảnh bằng chứng.`);
        break;
      }
      next.push(file);
    }

    onChange(next);
    setError(Array.from(new Set(messages)).join(' '));
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Images size={16} className="text-brand-teal" aria-hidden="true" />
          Hình ảnh / Bằng chứng thực tế <span className="text-xs font-normal text-slate-500">(tùy chọn)</span>
        </h3>
        <span aria-live="polite" className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-teal">
          {files.length}/{maxFiles} ảnh
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
        className={dragging ? 'rounded-xl bg-teal-50 ring-2 ring-brand-teal' : ''}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Chọn ảnh bằng chứng tải lên Cloudinary"
          aria-describedby={`${id}-hint`}
          disabled={disabled}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />

        {files.length === 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 px-4 py-5 text-center transition hover:border-brand-teal hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:cursor-wait disabled:opacity-50"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-white text-brand-teal shadow-2xs">
              <ImagePlus size={18} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold text-brand-teal">Tải ảnh chụp từ thiết bị</span>
            <span className="text-[11px] text-slate-500">Bấm để chọn file hoặc kéo thả ảnh vào đây</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {files.map((file, index) => (
              <Preview
                key={`${file.name}-${file.size}-${file.lastModified}`}
                file={file}
                remove={() => {
                  onChange(files.filter((_, i) => i !== index));
                  setError('');
                }}
                disabled={disabled}
              />
            ))}
            {files.length < maxFiles && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-teal-300 bg-teal-50/40 text-brand-teal transition hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-50"
              >
                <ImagePlus size={20} aria-hidden="true" />
                <span className="text-[11px] font-bold">Thêm ảnh</span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
