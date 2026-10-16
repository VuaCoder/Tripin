'use client';
import { Check } from 'lucide-react';

export function AgencyTourStepper({
  steps,
  active,
  onChange,
  allowSkip = false,
}: {
  steps: readonly { id: number; title: string; complete?: boolean }[];
  active: number;
  onChange: (id: number) => void;
  allowSkip?: boolean;
}) {
  return (
    <nav aria-label="Lộ trình thiết lập tour" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <ol className="grid grid-cols-4">
        {steps.map((step, index) => {
          const isClickable = allowSkip ? true : step.id <= active;
          return (
            <li key={step.id} className="relative min-w-0 text-center">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[18px] h-px w-full ${step.complete ? 'bg-primary' : 'bg-slate-300'}`}
                />
              )}
              <button
                type="button"
                disabled={!isClickable}
                aria-current={active === step.id ? 'step' : undefined}
                aria-label={`Bước ${step.id}: ${step.title}`}
                onClick={() => {
                  if (isClickable) {
                    onChange(step.id);
                  }
                }}
                className={`relative z-10 flex min-h-20 w-full flex-col items-center gap-3 rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  !isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold ${
                    active === step.id
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : step.complete
                      ? 'border-teal-200 bg-teal-50 text-primary'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {step.complete && active !== step.id ? <Check size={18} /> : step.id}
                </span>
                <span
                  className={`text-xs leading-relaxed sm:text-sm ${
                    active === step.id ? 'font-semibold text-primary' : 'text-slate-600'
                  }`}
                >
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

