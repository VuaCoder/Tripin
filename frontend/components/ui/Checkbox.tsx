import React, { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, event?: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked,
    defaultChecked,
    onChange,
    label,
    description,
    error,
    disabled = false,
    className,
    id,
    ...props
  },
  ref,
) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked, e);
  };

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'group relative inline-flex items-start gap-2.5 select-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        <span className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            onChange={handleChange}
            className="peer sr-only"
            {...props}
          />
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-md border transition-all duration-150',
              'border-slate-300 bg-white shadow-2xs group-hover:border-brand-teal',
              'peer-checked:border-brand-teal peer-checked:bg-brand-teal peer-checked:text-white',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-teal/40 peer-focus-visible:ring-offset-1',
              error && 'border-red-400 peer-checked:border-red-500 peer-checked:bg-red-500',
            )}
          >
            <Check
              className={cn(
                'size-3.5 stroke-[3] transition-transform duration-150',
                checked ? 'scale-100 opacity-100 text-white' : 'scale-0 opacity-0 text-transparent',
              )}
            />
          </span>
        </span>

        {(label || description) && (
          <div className="flex flex-col text-sm">
            {label && <span className="text-slate-800 leading-snug">{label}</span>}
            {description && <span className="text-xs text-slate-500 mt-0.5 leading-normal">{description}</span>}
          </div>
        )}
      </label>

      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
});

