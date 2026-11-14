import type { BookedExtra } from '@travel-platform/constants';
import { formatVnd } from '@/lib/travel-format';
export function BookedExtrasSummary({ services = [], meetingPoint }: { services?: BookedExtra[]; meetingPoint?: string }) {
  if (!services.length && !meetingPoint) return null;
  return <section className="my-5 rounded-xl border border-slate-200 bg-white p-5" aria-label="Dịch vụ đã chọn">
    <h3 className="text-base font-bold text-slate-900">Dịch vụ đã chọn</h3>
    {meetingPoint && <p className="mt-2 text-sm text-slate-600">Điểm tập trung: {meetingPoint}</p>}
    <ul className="mt-3 divide-y divide-slate-100">{services.map(s => <li key={s.serviceId} className="py-3 text-sm"><div className="flex justify-between gap-4"><strong>{s.name} × {s.quantity}</strong><span className="whitespace-nowrap font-semibold tabular-nums">{formatVnd(s.total)}</span></div><p className="mt-1 text-slate-600">{s.description}</p>{s.participants.length > 0 && <p className="mt-1 text-slate-600">Sử dụng: {s.participants.map(p => p.fullName).join(', ')}</p>}{s.pickups.map(p => <p key={p.passengerId} className="mt-1 text-slate-600">Đón {s.participants.find(person => person.passengerId === p.passengerId)?.fullName}: {p.address}</p>)}{s.instructions && <p className="mt-1 text-slate-600">{s.instructions}</p>}</li>)}</ul>
  </section>;
}
