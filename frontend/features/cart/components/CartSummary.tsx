'use client';

import type { CartItem, CartTotals } from '../types';
import { formatParticipants, formatVnd } from '../utils/format';
import { Button } from '@/components/ui';

export interface CartSummaryProps {
  totals: CartTotals;
  /** The line the "continue" action books (the newest bookable one). */
  firstAvailable?: CartItem;
  busy?: boolean;
  onContinue?: (item: CartItem) => void;
}

/** Backend-computed totals. The cart never sums prices on the client: the numbers come from `GET /cart`. */
export function CartSummary({ totals, firstAvailable, busy = false, onContinue }: CartSummaryProps) {
  const canContinue = Boolean(firstAvailable) && !busy;

  return (
    <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <h2 className="text-base font-bold text-slate-900">Tổng giỏ hàng</h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Số tour</dt>
          <dd className="font-semibold text-slate-800" data-testid="cart-total-items">{totals.itemCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Số khách (đặt được)</dt>
          <dd className="font-semibold text-slate-800" data-testid="cart-total-participants">{formatParticipants(totals.participantCount)}</dd>
        </div>
        {totals.unavailableCount > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-amber-700">Không còn khả dụng</dt>
            <dd className="font-semibold text-amber-700" data-testid="cart-total-unavailable">{totals.unavailableCount}</dd>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <dt className="font-semibold text-slate-700">Tạm tính</dt>
          <dd className="text-lg font-extrabold text-primary-container" data-testid="cart-total-subtotal" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatVnd(totals.subtotal)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Tạm tính chỉ gồm các tour còn đặt được. Mã giảm giá được áp dụng ở bước đặt chỗ; mỗi tour được đặt và thanh toán riêng.
      </p>

      <Button className="mt-4 w-full" disabled={!canContinue} onClick={() => firstAvailable && onContinue?.(firstAvailable)}>
        Tiến hành đặt chỗ
      </Button>
    </aside>
  );
}
