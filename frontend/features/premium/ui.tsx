export const premiumInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700';
export const premiumButton =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50';
export const premiumMoney = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    amount,
  );
export const premiumDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(value))
    : 'Chưa bắt đầu';
export function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="my-4 text-sm text-red-800">
      Không tải được dữ liệu.{' '}
      <button className="font-semibold underline" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}
