'use client';
import { usePremiumResourceQuery } from './api';
import { premiumDate, premiumMoney, Retry } from './ui';
export function PremiumOperations() {
  const query = usePremiumResourceQuery('/admin/premium/operations', {
    pollingInterval: 60000,
  });
  const data = query.currentData as
    | {
        unfulfilled: {
          id: string;
          referenceId: string;
          amount: number;
          paidAt: string | null;
        }[];
        overdueHolds: number;
        pendingRefunds: number;
      }
    | undefined;
  return (
    <section className="space-y-4 border-t border-slate-200 pt-6">
      <h2 className="text-xl font-bold">Theo dõi vận hành</h2>
      {query.isError ? (
        <Retry onRetry={() => void query.refetch()} />
      ) : !data ? (
        <p role="status">Đang tải vận hành…</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {data.pendingRefunds} yêu cầu hoàn cần xử lý · {data.overdueHolds}{' '}
            lượt giữ hạn mức quá hạn đang chờ đối soát.
          </p>
          <h3 className="font-semibold">
            Thanh toán gói đã nhận tiền, chờ hoàn tất quyền lợi
          </h3>
          {!data.unfulfilled.length ? (
            <p className="text-sm text-teal-800">
              Không có giao dịch tồn đọng.
            </p>
          ) : (
            data.unfulfilled.map((p) => (
              <p key={p.id} className="break-all border-b py-3 text-sm">
                {p.id} · {premiumMoney(p.amount)} · {premiumDate(p.paidAt)}
              </p>
            ))
          )}
          <p className="text-xs text-slate-600">
            Job hệ thống tự thử lại mỗi phút. Giao dịch tồn đọng cần kiểm tra
            log trước khi xử lý thủ công.
          </p>
        </>
      )}
    </section>
  );
}
