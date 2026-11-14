'use client';
import { extraTerms, type TourExtra, type ExtraSelection, type ExtraPassenger } from '@travel-platform/constants';
import { formatVnd } from '@/lib/travel-format';
import styles from '@/features/tours/components/tour-services.module.css';

export function BookingExtras({ services, passengers, value, onChange, departureDate, meetingPoint }: {
  services: TourExtra[]; passengers: ExtraPassenger[]; value: ExtraSelection[];
  onChange: (value: ExtraSelection[]) => void; departureDate: string; meetingPoint?: string;
}) {
  const change = (id: string, next?: ExtraSelection) => onChange([...value.filter(s => s.serviceId !== id), ...(next ? [next] : [])]);
  const available = services.filter(s => s.active && Date.parse(departureDate) - Date.now() > s.cutoffHours * 3600000);
  if (!available.length && !value.length && !meetingPoint) return null;
  return <section className={styles.section} aria-labelledby="booking-extras-heading">
    <div className={styles.heading}><div><h3 id="booking-extras-heading">Dịch vụ cho chuyến đi</h3><p>Tùy chọn cho từng người. Bạn chỉ thanh toán những dịch vụ đã chọn.</p></div><span className={styles.badge}>Không bắt buộc</span></div>
    {meetingPoint && <p className={styles.note}>Khách tự di chuyển tập trung tại: <strong>{meetingPoint}</strong></p>}
    {value.some(v => !available.some(s => s.id === v.serviceId)) && <p role="alert" className={styles.error}>Một dịch vụ đã hết hạn hoặc ngừng bán. <button type="button" className="underline" onClick={() => onChange(value.filter(v => available.some(s => s.id === v.serviceId)))}>Bỏ dịch vụ không còn bán</button></p>}
    {available.map(s => {
      const selected = value.find(v => v.serviceId === s.id);
      const stale = selected && selected.terms !== extraTerms(s);
      const create = (): ExtraSelection => ({ serviceId: s.id, terms: extraTerms(s), passengerIds: [], quantity: 1, pickups: [] });
      const eligible = passengers.filter(p => s.ages.includes(p.ageGroup));
      const togglePerson = (person: ExtraPassenger, checked: boolean) => {
        const current = selected ?? create();
        const ids = checked ? [...current.passengerIds, person.passengerId] : current.passengerIds.filter(id => id !== person.passengerId);
        change(s.id, ids.length ? { ...current, passengerIds: ids, pickups: current.pickups.filter(p => ids.includes(p.passengerId)) } : undefined);
      };
      const address = (personId: string, text: string) => selected && change(s.id, { ...selected, pickups: [...selected.pickups.filter(p => p.passengerId !== personId), { passengerId: personId, address: text }] });
      return <div key={s.id} className={styles.choice}>
        <div className={styles.choiceHead}><div><h4>{s.name}</h4><p>{s.description}</p></div><span className={styles.price}>{s.price ? formatVnd(s.price) : 'Miễn phí'}<br /><span className="text-xs font-normal">/ {s.pricing === 'PER_PERSON' ? 'người' : s.pricing === 'PER_BOOKING' ? 'booking' : s.unit}</span></span></div>
        {s.pricing === 'PER_PERSON' ? <>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-600"><span>{selected?.passengerIds.length ?? 0}/{passengers.length} người sử dụng</span><button type="button" className="min-h-11 px-2 font-semibold text-teal-800 underline underline-offset-4" onClick={() => change(s.id, selected?.passengerIds.length === eligible.length ? undefined : { ...create(), passengerIds: eligible.slice(0, s.maxQuantity).map(p => p.passengerId) })}>Chọn / bỏ tất cả</button></div>
          <div className={styles.people}>{passengers.map((p, i) => <label key={p.passengerId}><input type="checkbox" disabled={!s.ages.includes(p.ageGroup) || (!selected?.passengerIds.includes(p.passengerId) && (selected?.passengerIds.length ?? 0) >= s.maxQuantity)} checked={selected?.passengerIds.includes(p.passengerId) ?? false} onChange={e => togglePerson(p, e.target.checked)} />{p.fullName.trim() || `Hành khách ${i + 1}`}</label>)}</div>
        </> : <div className={styles.checks}><label><input type="checkbox" checked={!!selected} onChange={e => change(s.id, e.target.checked ? create() : undefined)} />Thêm dịch vụ</label>{selected && s.pricing === 'PER_UNIT' && <label>Số lượng<input className="w-20 rounded-md border border-slate-300 px-2 py-2" aria-label={`Số lượng ${s.name}`} type="number" min={1} max={s.maxQuantity} value={selected.quantity} onChange={e => change(s.id, { ...selected, quantity: Number(e.target.value) })} /></label>}</div>}
        {stale && <p role="alert" className={styles.error}>Giá hoặc điều kiện dịch vụ đã thay đổi. <button type="button" className="underline" onClick={() => change(s.id, undefined)}>Bỏ chọn để xem lại</button></p>}
        {selected && s.pickup && <div className={styles.pickup}>
          <p className="text-sm font-semibold">Khu vực đón: {s.pickup.area}</p><p className="text-xs leading-5">{s.pickup.instructions} Chỉ nhập địa chỉ trong khu vực phục vụ. Ngoài khu vực này, vui lòng liên hệ đơn vị tổ chức trước khi đặt.</p>
          {selected.passengerIds.map((id, i) => <label key={id}>Điểm đón · {passengers.find(p => p.passengerId === id)?.fullName || 'Hành khách'}
            {s.pickup!.mode === 'POINT' ? <select value={selected.pickups.find(p => p.passengerId === id)?.address ?? ''} onChange={e => address(id, e.target.value)}><option value="">Chọn điểm đón</option>{s.pickup!.points.map(point => <option key={point}>{point}</option>)}</select>
              : <input required minLength={5} maxLength={300} value={selected.pickups.find(p => p.passengerId === id)?.address ?? ''} placeholder="Tên khách sạn, số nhà, đường, phường" onChange={e => address(id, e.target.value)} />}
            {i === 0 && selected.passengerIds.length > 1 && <button type="button" className="min-h-11 text-left text-xs font-semibold text-teal-800 underline" onClick={() => change(s.id, { ...selected, pickups: selected.passengerIds.map(pid => ({ passengerId: pid, address: selected.pickups.find(p => p.passengerId === id)?.address ?? '' })) })}>Dùng điểm đón này cho những người đã chọn</button>}
          </label>)}
        </div>}
      </div>;
    })}
    <p className={styles.note}>Mã giảm giá chỉ áp dụng giá tour. Phí dịch vụ được cộng riêng và theo chính sách hủy của đơn đặt tour.</p>
  </section>;
}
