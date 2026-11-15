import type { TourExtra } from '@travel-platform/constants';

export function AgencyTourServicesSummary({ services = [] }: { services?: TourExtra[] }) {
  return <section aria-label="Dịch vụ bổ sung" className="mt-6 border-t border-slate-100 pt-5">
    <h3 className="font-semibold text-slate-900">Dịch vụ bổ sung{services.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({services.length})</span>}</h3>
    {services.length === 0 ? <p className="mt-2 text-sm text-slate-600">Chưa có dịch vụ bổ sung.</p> : <>
      <p className="mt-1 text-sm text-slate-600">Khách chọn mua thêm khi đặt tour, không nằm trong giá cơ bản.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {services.map(service => <li key={service.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h4 className="min-w-0 break-words text-sm font-semibold text-slate-900">{service.name}{!service.active && <span className="ml-2 text-xs font-normal text-slate-500">Ngừng bán</span>}</h4>
            <p className="text-sm font-semibold tabular-nums text-teal-800">{service.price === 0 ? 'Miễn phí' : `${service.price.toLocaleString('vi-VN')} ₫/${service.pricing === 'PER_PERSON' ? 'người' : service.pricing === 'PER_BOOKING' ? 'booking' : service.unit}`}</p>
          </div>
          {service.description && <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">{service.description}</p>}
          <p className="mt-1 text-xs text-slate-500">{service.cutoffHours > 0 ? `Đặt trước khởi hành ít nhất ${service.cutoffHours} giờ` : 'Có thể đặt đến giờ khởi hành'}</p>
          {service.kind === 'PICKUP' && service.pickup && <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p><span className="font-medium">Khu vực đón:</span> {service.pickup.area}</p>
            {service.pickup.mode === 'POINT' && service.pickup.points.length > 0 && <p className="break-words"><span className="font-medium">Điểm đón:</span> {service.pickup.points.join('; ')}</p>}
            {service.pickup.instructions && <p className="whitespace-pre-line break-words">{service.pickup.instructions}</p>}
          </div>}
        </li>)}
      </ul>
    </>}
  </section>;
}
