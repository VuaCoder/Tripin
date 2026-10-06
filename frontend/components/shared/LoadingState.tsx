export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Đang tải...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex min-h-32 flex-col items-center justify-center gap-3 text-sm text-slate-500 ${className}`} role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
