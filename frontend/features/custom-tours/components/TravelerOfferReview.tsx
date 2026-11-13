'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ageUnitPrice, guestTotal } from '@travel-platform/constants';
import { Button } from '@/components/ui';
import { getApiErrorCode, getApiErrorMessage } from '@/features/auth/utils/apiError';
import { formatVnd } from '@/features/review';
import { useAcceptCustomTourOfferMutation } from '../api';
import { STATUS_LABELS, guestSummary } from '../labels';
import { customTourHref } from '../links';
import type { CustomTourOfferContent, CustomTourRequestDto } from '../types';
import { requestDate } from './CustomTourPinCard';

const priceLabel = (price: number | null | undefined) => (price === null || price === undefined ? 'Chưa công bố' : formatVnd(price));

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

/** The negotiated tour as the agency sent it: what the traveler is buying, next to the price. */
function OfferDetails({ content }: { content: CustomTourOfferContent }) {
  const policies = [
    { label: 'Chính sách hủy', text: content.cancellationPolicy },
    { label: 'Chính sách giá trẻ em', text: content.childPricingPolicy },
    { label: 'Lưu ý khi đi', text: content.travelNotes },
    { label: 'Giấy tờ cần mang', text: content.requiredDocuments },
  ].filter((policy) => policy.text);
  return (
    <section aria-label="Thông tin tour" className="space-y-2 rounded-lg border border-slate-200 px-3 py-3">
      <div>
        <p className="font-semibold text-slate-900">{content.title}</p>
        <p className="text-xs text-slate-600">{content.destination} · {content.durationDays} ngày</p>
      </div>
      {content.summary && <p className="text-xs text-slate-600">{content.summary}</p>}
      {content.description && <p className="whitespace-pre-line text-xs text-slate-600">{content.description}</p>}
      {!!content.inclusions?.length && <DetailList title="Bao gồm" items={content.inclusions} />}
      {!!content.exclusions?.length && <DetailList title="Không bao gồm" items={content.exclusions} />}
      {policies.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Chính sách &amp; lưu ý</summary>
          <dl className="mt-1 space-y-1.5">
            {policies.map((policy) => (
              <div key={policy.label}>
                <dt className="text-xs font-semibold text-slate-700">{policy.label}</dt>
                <dd className="whitespace-pre-line text-xs text-slate-600">{policy.text}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

/** Traveler side of the chat panel: the frozen offer, then one explicit confirmation that posts its revision. */
// shortcut: the traveler sees the frozen snapshot only, never the agency's unsent edits; add a traveler read of the
// private tour if live negotiation has to be followed here.
export function TravelerOfferReview({ request, onRefetch }: { request: CustomTourRequestDto; onRefetch: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [accept, { isLoading }] = useAcceptCustomTourOfferMutation();
  const offer = request.offer;
  const href = customTourHref(request, 'TRAVELER');
  const date = requestDate(request);

  const rows = offer
    ? [
        { key: 'adults', label: 'Người lớn', count: offer.guestCounts.adults, price: offer.unitPrice },
        { key: 'children', label: 'Trẻ em', count: offer.guestCounts.children, price: ageUnitPrice(offer.unitPrice, offer.agePricing, 'child') },
        { key: 'infants', label: 'Em bé', count: offer.guestCounts.infants, price: ageUnitPrice(offer.unitPrice, offer.agePricing, 'infant') },
      ].filter((row) => row.count > 0)
    : [];

  const submit = async () => {
    setError('');
    try {
      await accept({ id: request.id, revision: request.revision }).unwrap();
      setConfirming(false);
    } catch (failure) {
      if (getApiErrorCode(failure) === 'CONCURRENT_UPDATE') {
        setError('Thỏa thuận vừa thay đổi. Đã tải bản mới, vui lòng xem lại trước khi chấp nhận.');
        onRefetch();
        return;
      }
      setError(getApiErrorMessage(failure, 'Không chấp nhận được thỏa thuận. Vui lòng thử lại.'));
    }
  };

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{STATUS_LABELS[request.status].label}</p>
        <p className="font-semibold text-slate-900">{guestSummary(request)}{date ? ` · ${date}` : ''}</p>
        {request.notes && <p className="text-xs text-slate-500">Ghi chú của bạn: {request.notes}</p>}
      </div>

      {offer?.content && <OfferDetails content={offer.content} />}

      {offer ? (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Bảng giá thỏa thuận</caption>
          <thead>
            <tr className="text-xs text-slate-500">
              <th scope="col" className="pb-1 font-medium">Nhóm</th>
              <th scope="col" className="pb-1 text-right font-medium">Giá/người</th>
              <th scope="col" className="pb-1 text-right font-medium">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="py-1.5">{row.label} × {row.count}</td>
                <td className="py-1.5 text-right">{priceLabel(row.price)}</td>
                <td className="py-1.5 text-right">{row.price === null ? '—' : formatVnd(row.price * row.count)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold text-slate-900">
              <th scope="row" className="py-2 text-left">Tổng cộng</th>
              <td />
              <td className="py-2 text-right">{formatVnd(offer.subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Đại lý đang chuẩn bị thỏa thuận. Báo giá và lịch trình chốt sẽ hiện ở đây khi được gửi.
        </p>
      )}

      {request.status === 'ACCEPTED' && (
        <div className="space-y-2 rounded-lg bg-emerald-50 px-3 py-2">
          <p className="font-semibold text-emerald-800">Bạn đã chấp nhận thỏa thuận.</p>
          {href && (
            <Link href={href} className="inline-block font-semibold text-emerald-900 underline">
              {request.nextStep === 'ENTER_PASSENGERS' ? 'Nhập hành khách' : 'Xem đơn'}
            </Link>
          )}
        </div>
      )}

      {request.status === 'OFFERED' && offer && !confirming && (
        <div className="flex justify-end">
          <Button onClick={() => { setConfirming(true); setError(''); }}>Chấp nhận thỏa thuận</Button>
        </div>
      )}

      {request.status === 'OFFERED' && offer && confirming && (
        <div role="group" aria-label="Xác nhận thỏa thuận" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3">
          <p className="font-semibold text-slate-900">Xác nhận chốt đoàn</p>
          <ul className="space-y-1 text-xs text-slate-700">
            <li>Ngày khởi hành: {date}</li>
            <li>Cơ cấu: {guestTotal(offer.guestCounts)} người ({offer.guestCounts.adults} người lớn{offer.guestCounts.children ? `, ${offer.guestCounts.children} trẻ em` : ''}{offer.guestCounts.infants ? `, ${offer.guestCounts.infants} em bé` : ''})</li>
            <li>Tổng tiền: {formatVnd(offer.subtotal)}</li>
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => void submit()} loading={isLoading}>Xác nhận chấp nhận</Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={isLoading}>Quay lại</Button>
          </div>
        </div>
      )}

      {(request.status === 'DECLINED' || request.status === 'CANCELLED') && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Yêu cầu đã đóng.</p>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
