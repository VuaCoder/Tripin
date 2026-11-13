'use client';

import { useState, type ChangeEventHandler, type HTMLInputTypeAttribute, type ReactNode } from 'react';

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
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const base = `w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
    error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-brand-tealLight focus:ring-cyan-50'
  }`;

  return (
    <div className="block">
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {multiline ? (
        <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required={required} rows={4} className={`${base} resize-y`} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} />
      ) : (
        <div className="relative">
          <input
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            onCopy={isPassword ? (e) => e.preventDefault() : undefined}
            onCut={isPassword ? (e) => e.preventDefault() : undefined}
            placeholder={placeholder}
            type={inputType}
            autoComplete={autoComplete}
            className={`${base} ${isPassword ? 'pr-11' : ''}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            required={required}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 focus:outline-none cursor-pointer"
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}
      {error ? <span id={`${name}-error`} className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span id={`${name}-hint`} className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}
