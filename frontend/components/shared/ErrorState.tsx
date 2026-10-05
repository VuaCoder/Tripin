import { Button } from '../ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = 'Có lỗi xảy ra',
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
  actionLabel = 'Thử lại',
  onAction,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-6 text-center" role="alert">
      <p className="font-semibold text-red-800">{title}</p>
      <p className="text-sm text-red-700">{message}</p>
      {onAction && <Button variant="outline" size="sm" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
