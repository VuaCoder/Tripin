import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  message,
  description,
  actionLabel = 'Tạo mới',
  onAction,
}: EmptyStateProps) {
  const text = description ?? message ?? 'Nội dung sẽ hiển thị tại đây khi có dữ liệu mới.';

  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 p-6 text-center">
      <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">inbox</span>
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="text-sm text-slate-500">{text}</p>
      {onAction && <Button size="sm" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
