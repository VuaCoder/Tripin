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
    <nav aria-label="Lộ trình thiết lập tour" className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-2xs">
      <ol className="relative grid grid-cols-4">
        {steps.map((step, index) => {
          const isClickable = allowSkip ? true : step.id <= active;
          const isActive = active === step.id;
          const isLineActive = index < active - 1 || (Boolean(step.complete) && Boolean(steps[index + 1]?.complete));

          return (
            <li key={step.id} className="relative min-w-0 flex flex-col items-center text-center">
              {/* Connecting line to the next step */}
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-[26px] w-full -translate-y-1/2 pointer-events-none z-0"
                >
                  <div
                    className={`h-[2px] w-full transition-colors duration-300 ${
                      isLineActive ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  />
                </div>
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
                className={`group relative z-10 flex w-full flex-col items-center gap-2 py-2 px-1 rounded-xl transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                }`}
              >
                <span
                  className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-all duration-200 group-hover:scale-105 ${
                    isActive
                      ? 'border-primary bg-primary text-white shadow-sm ring-4 ring-primary/20 scale-105'
                      : step.complete
                      ? 'border-teal-400 bg-teal-50 text-primary'
                      : 'border-slate-300 bg-white text-slate-500 group-hover:border-primary/50 group-hover:text-primary'
                  }`}
                >
                  {step.complete && !isActive ? <Check size={18} strokeWidth={2.5} /> : step.id}
                </span>

                <span
                  className={`text-xs leading-tight sm:text-sm transition-colors text-center ${
                    isActive
                      ? 'font-bold text-primary'
                      : step.complete
                      ? 'font-semibold text-slate-800 group-hover:text-primary'
                      : 'font-medium text-slate-500 group-hover:text-slate-800'
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
