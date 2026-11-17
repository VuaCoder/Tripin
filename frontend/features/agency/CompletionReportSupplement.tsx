import type { CompletionReport } from './completionApi';

type Supplement = Pick<CompletionReport, 'services' | 'bookedServices' | 'serviceConfirmations' | 'absenceReason' | 'additionalNotes' | 'noChanges' | 'noIncidents'>;
const statusLabels = { UNCONFIRMED: 'Chưa xác nhận', PROVIDED: 'Đã cung cấp', NOT_PROVIDED: 'Chưa cung cấp', NOT_APPLICABLE: 'Không bao gồm', PARTIALLY_PROVIDED: 'Cung cấp một phần' };

/** Shared read-only fields for agency history and internal review. */
export function CompletionReportSupplement({ report }: { report: Supplement }) {
  return <div className="space-y-3 text-sm text-slate-700">
    {report.noChanges && <p>Không có thay đổi so với kế hoạch.</p>}
    {report.bookedServices !== undefined && <div><h4 className="font-semibold text-slate-900">Dịch vụ mua thêm trong booking</h4>{report.bookedServices.length ? <dl className="mt-2 space-y-2">{report.bookedServices.map(service => <div key={service.key} className="flex flex-wrap justify-between gap-2"><dt className="min-w-0 break-words">{service.name} · {service.quantity} {service.unit} · {service.bookingCount} booking</dt><dd className="font-medium">{statusLabels[report.serviceConfirmations?.find(s => s.key === service.key)?.status ?? 'UNCONFIRMED']}</dd></div>)}</dl> : <p className="mt-1">Không có dịch vụ mua thêm.</p>}</div>}
    {report.bookedServices === undefined && report.services && <div><h4 className="font-semibold text-slate-900">Xác nhận dịch vụ (mẫu cũ)</h4><dl className="mt-2 space-y-2">
      {([{ key: 'transport', label: 'Phương tiện di chuyển' }, { key: 'guide', label: 'Hướng dẫn viên' }, { key: 'entranceTickets', label: 'Vé tham quan' }] as const).map(item => <div key={item.key} className="flex flex-wrap justify-between gap-2"><dt>{item.label}</dt><dd className="font-medium">{statusLabels[report.services![item.key]]}</dd></div>)}
    </dl></div>}
    {report.absenceReason && <div><h4 className="font-semibold text-slate-900">Khách vắng mặt và phương án xử lý</h4><p className="mt-1 whitespace-pre-wrap break-words">{report.absenceReason}</p></div>}
    {report.noIncidents && <p>Không có sự cố.</p>}
    {report.additionalNotes && <div><h4 className="font-semibold text-slate-900">Ghi chú bổ sung</h4><p className="mt-1 whitespace-pre-wrap break-words">{report.additionalNotes}</p></div>}
  </div>;
}
