'use client';
import { Check } from 'lucide-react';

export function AgencyTourStepper({
  steps,
  active,
  onChange,
  allowSkip = true,
}: {
  steps: readonly { id: number; title: string; complete?: boolean }[];
  active: number;
  onChange: (id: number) => void;
  allowSkip?: boolean;
}) {
  return (
    <nav aria-label="Lộ trình thiết lập tour" className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-2xs">
      <ol className="grid grid-cols-4 gap-1">
        {steps.map((step, index) => {
          const isClickable = allowSkip ? true : step.id <= active;
          const isActive = active === step.id;
          return (
            <li key={step.id} className="relative min-w-0 text-center">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[18px] h-0.5 w-full ${step.complete ? 'bg-primary' : 'bg-slate-200'}`}
                />
              )}
              <button
                type="button"
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Bước ${step.id}: ${step.title}`}
                title={`Chuyển sang bước ${step.id}: ${step.title}`}
                onClick={() => {
                  if (isClickable) {
                    onChange(step.id);
                  }
                }}
                className={`group relative z-10 flex min-h-18 w-full flex-col items-center gap-2 rounded-xl p-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  isActive
                    ? 'bg-teal-50/70 text-primary shadow-2xs font-semibold'
                    : isClickable
                    ? 'cursor-pointer hover:bg-slate-50 text-slate-600'
                    : 'cursor-not-allowed opacity-50 text-slate-400'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-transform group-hover:scale-105 ${
                    isActive
                      ? 'border-primary bg-primary text-white shadow-sm ring-4 ring-primary/15'
                      : step.complete
                      ? 'border-teal-300 bg-teal-50 text-primary'
                      : 'border-slate-300 bg-white text-slate-500 group-hover:border-primary/50 group-hover:text-primary'
                  }`}
                >
                  {step.complete && !isActive ? <Check size={18} /> : step.id}
                </span>
                <span
                  className={`text-xs leading-tight sm:text-sm transition-colors ${
                    isActive ? 'font-bold text-primary' : 'font-medium group-hover:text-slate-900'
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

