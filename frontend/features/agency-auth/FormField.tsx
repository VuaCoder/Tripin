import type { ChangeEventHandler, HTMLInputTypeAttribute, ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  error?: string;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: ReactNode;
}

export function FormField({ label, name, value, onChange, error, placeholder, type = 'text', autoComplete, multiline, hint, required }: FormFieldProps) {
  const base = `w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-brand-tealLight focus:ring-cyan-50'
  }`;

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {multiline ? (
        <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required={required} rows={4} className={`${base} resize-y`} aria-invalid={Boolean(error)} />
      ) : (
        <input name={name} value={value} onChange={onChange} placeholder={placeholder} type={type} autoComplete={autoComplete} className={base} aria-invalid={Boolean(error)} required={required} />
      )}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}
