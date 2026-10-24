import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, type, inputMode, onKeyDown, onPaste, ...props },
  ref,
) {
  const isNumeric = type === 'number' || inputMode === 'numeric';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNumeric && (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isNumeric) {
      const text = e.clipboardData?.getData('text');
      if (text && /[eE+-]/.test(text)) {
        e.preventDefault();
      }
    }
    onPaste?.(e);
  };

  return (
    <input
      ref={ref}
      type={type}
      inputMode={inputMode}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition',
        'placeholder:text-slate-400 focus:ring-2 focus:ring-brand-teal/20',
        invalid ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-brand-teal',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});
