import type { ModerationTour } from '../types';
import { TOUR_STATUS_LABELS } from '../labels';
import { dateTime, money } from './ModerationUi';

const when = (value?: string) => value ? dateTime.format(new Date(value)) : 'Chưa có';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 border-t border-slate-200 pt-4"><h4 className="font-bold text-slate-900">{title}</h4>{children}</section>;
}

function Lines({ items }: { items?: string[] }) {
  return items?.length ? <ul className="list-disc space-y-1 pl-5 text-slate-700">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="text-slate-500">Chưa có thông tin</p>;
}

export function ModerationTourDetails({ tour }: { tour: ModerationTour }) {
  return <div className="space-y-4 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TOUR_STATUS_LABELS[tour.status].className}`}>{TOUR_STATUS_LABELS[tour.status].label}</span>
      <span className="text-slate-600">{tour.visibility === 'PRIVATE' ? 'Tour riêng' : 'Tour công khai'}</span>
    </div>
    <h3 className="text-lg font-bold text-slate-900">{tour.title}</h3>
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
      {[
        ['Agency gửi tour', tour.agency?.name || 'Chưa có thông tin'],
        ['Gửi duyệt lúc', when(tour.submittedAt)],
        ['Tạo lúc', when(tour.createdAt)],
        ['Cập nhật lúc', when(tour.updatedAt)],
        ['Xét duyệt lúc', when(tour.reviewedAt)],
        ['Điểm đến', tour.destination],
        ['Thời lượng', `${tour.durationDays} ngày`],
        ['Giá cơ bản', money.format(tour.basePrice)],
        ['Quy mô tối đa', tour.maxGroupSize ? `${tour.maxGroupSize} khách` : 'Chưa có thông tin'],
        ['Danh mục', tour.categories?.map(c => c.name).join(', ') || 'Chưa có thông tin'],
      ].map(([label, value]) => <div key={label} className="flex flex-wrap items-baseline gap-x-1.5"><dt className="font-medium text-slate-600">{label}:</dt><dd className="font-semibold text-slate-800">{value}</dd></div>)}
    </dl>
    {tour.statusReason && <p className="rounded-xl bg-amber-50 p-3 text-amber-900"><strong>Lý do trạng thái:</strong> {tour.statusReason}</p>}
    <Section title="Giới thiệu"><p className="whitespace-pre-wrap text-slate-700">{tour.summary || 'Chưa có tóm tắt'}</p><p className="whitespace-pre-wrap text-slate-700">{tour.description || 'Chưa có mô tả'}</p></Section>
    <Section title="Ảnh tour">{tour.images?.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{tour.images.map((src, index) => <a key={index} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Mở ảnh tour ${index + 1}`}><img src={src} alt={`${tour.title} - ảnh ${index + 1}`} className="aspect-video w-full rounded-lg object-cover" /></a>)}</div> : <p className="text-slate-500">Chưa có ảnh</p>}</Section>
    <Section title="Điểm nổi bật"><Lines items={tour.highlights} /></Section>
    <Section title="Lịch trình">{tour.itinerary?.length ? <ol className="space-y-3">{tour.itinerary.map((day, index) => <li key={index}><p className="font-semibold text-slate-800">Ngày {day.day}{day.toDay && day.toDay > day.day ? `–${day.toDay}` : ''}: {day.title}</p>{day.description && <p className="whitespace-pre-wrap text-slate-700">{day.description}</p>}<Lines items={day.activities} /></li>)}</ol> : <p className="text-slate-500">Chưa có lịch trình</p>}</Section>
    <Section title="Dịch vụ bao gồm"><Lines items={tour.inclusions} /></Section>
    <Section title="Dịch vụ không bao gồm"><Lines items={tour.exclusions} /></Section>
    <Section title="Khởi hành">{tour.departures?.length ? <ul className="space-y-2">{tour.departures.map(d => <li key={d.id} className="text-slate-700">{when(d.date)} · {money.format(d.price)} · {d.remaining}/{d.capacity} chỗ còn · {d.isOpen ? 'Đang mở' : 'Đã đóng'}</li>)}</ul> : <p className="text-slate-500">Chưa có lịch khởi hành</p>}</Section>
    <Section title="Thông tin tham gia"><dl className="space-y-2 text-slate-700"><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Điểm gặp:</dt><dd>{tour.meetingPoint || 'Chưa có thông tin'}</dd></div><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Giấy tờ cần thiết:</dt><dd className="whitespace-pre-wrap">{tour.requiredDocuments || 'Chưa có thông tin'}</dd></div><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Lưu ý:</dt><dd className="whitespace-pre-wrap">{tour.travelNotes || 'Chưa có thông tin'}</dd></div><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Giá trẻ em và em bé:</dt><dd>{tour.agePricing ? `Trẻ em: ${tour.agePricing.childPrice != null ? money.format(tour.agePricing.childPrice) : `${tour.agePricing.childPercent}% giá cơ bản`}; em bé: ${tour.agePricing.infantPrice != null ? money.format(tour.agePricing.infantPrice) : `${tour.agePricing.infantPercent}% giá cơ bản`}` : 'Chưa có thông tin'}</dd></div><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Chính sách trẻ em:</dt><dd className="whitespace-pre-wrap">{tour.childPricingPolicy || 'Chưa có thông tin'}</dd></div><div className="flex flex-wrap gap-x-1.5"><dt className="font-semibold">Chính sách hủy:</dt><dd className="whitespace-pre-wrap">{tour.cancellationPolicy || 'Chưa có thông tin'}</dd></div></dl></Section>
    {tour.guide && <Section title="Hướng dẫn viên"><p className="text-slate-700">{tour.guide.fullName}</p></Section>}
  </div>;
}
