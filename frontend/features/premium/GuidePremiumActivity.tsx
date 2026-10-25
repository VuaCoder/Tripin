'use client';
import { usePremiumResourceQuery } from './api';
import { premiumDate } from './ui';
const names: Record<string, string> = {
  ASSIGNED: 'Được phân công',
  UNASSIGNED: 'Đã gỡ phân công',
  ACCEPTED: 'Đã nhận tour',
  DECLINED: 'Đã từ chối tour',
  BOOKING_COMPLETED: 'Booking hoàn tất',
};
export function GuidePremiumActivity() {
  const query = usePremiumResourceQuery('/premium/guide/analytics');
  const data = query.currentData as
    | {
        activity?: {
          id: string;
          action: string;
          tourTitle: string;
          occurredAt: string;
        }[];
      }
    | undefined;
  if (query.isError || !data) return null;
  return (
    <section className="space-y-3 border-t border-slate-200 pt-6">
      <h2 className="text-xl font-bold">Lịch sử hoạt động</h2>
      <p className="text-xs text-slate-600">
        Tối đa 200 hoạt động gần nhất, ghi nhận từ khi triển khai Premium. Dữ
        liệu phân công cũ không được suy diễn thành lịch sử.
      </p>
      {!data.activity?.length ? (
        <p className="text-sm text-slate-600">
          Chưa có hoạt động được ghi nhận.
        </p>
      ) : (
        data.activity.map((a) => (
          <article
            key={a.id}
            className="border-b border-slate-200 py-3 text-sm"
          >
            <p className="font-semibold">
              {names[a.action] ?? a.action} · {a.tourTitle}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {premiumDate(a.occurredAt)}
            </p>
          </article>
        ))
      )}
    </section>
  );
}
