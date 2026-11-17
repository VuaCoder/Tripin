'use client';
import { Modal } from 'antd';
import type { GuestCounts } from '@travel-platform/constants';
import { useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, FolderOpen, LoaderCircle, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { AgencyDenied, AgencyError, AgencyLoading, agencyButton, agencyInput, dateTime, useAgencyPermission } from './AgencyCommon';
import { useAppSelector } from '@/store/hooks';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { getTourApiMessage } from '@/features/tours/api/toursApi';
import { useDepartureCompletionQuery, useSaveCompletionMutation, useUploadCompletionImageMutation, type CompletionReport, type DepartureCompletion, type ExtraServiceStatus, type CompletionBookedService } from './completionApi';

const serviceLabels: Record<ExtraServiceStatus, string> = { UNCONFIRMED: 'Chưa xác nhận', PROVIDED: 'Đã cung cấp', NOT_PROVIDED: 'Chưa cung cấp', PARTIALLY_PROVIDED: 'Cung cấp một phần' };
const reportFields = (payload?: CompletionReport, bookedServices: CompletionBookedService[] = []) => ({
  summary: payload?.summary ?? '', changes: payload?.changes ?? '', incidents: payload?.incidents ?? '',
  noChanges: payload?.noChanges ?? !payload?.changes, noIncidents: payload?.noIncidents ?? !payload?.incidents,
  serviceConfirmations: bookedServices.map(service => ({ key: service.key, status: payload?.serviceConfirmations?.find(s => s.key === service.key)?.status ?? 'UNCONFIRMED' as const })),
  absenceReason: payload?.absenceReason ?? '', additionalNotes: payload?.additionalNotes ?? '', evidence: payload?.evidence ?? [],
});

const attendedTotal = (data: DepartureCompletion) => {
  const payload = data.reports[0]?.payload;
  return payload?.actualParticipants ?? (payload?.attendance.length
    ? payload.attendance.reduce((sum, a) => sum + (a.attendedCount ?? 0), 0)
    : data.bookings.reduce((sum, b) => sum + (b.attendedParticipants ?? b.participants), 0));
};

function ReportForm({ data, tourId, departureId }: { data: DepartureCompletion; tourId: string; departureId: string }) {
  const [amending, setAmending] = useState(false);
  const bookedServices = data.reports[0]?.payload.bookedServices ?? data.bookedServices ?? [];
  const bookedGuests = data.reports[0]?.payload.bookedGuests ?? data.bookedGuests ?? { adults: data.bookings.reduce((sum, b) => sum + b.participants, 0), children: 0, infants: 0 };
  const legacyTotalOnly = !!data.completedAt && !amending && !data.reports[0]?.payload.actualGuests && attendedTotal(data) !== bookedGuests.adults + bookedGuests.children + bookedGuests.infants;
  const [report, setReport] = useState<CompletionReport>(() => ({
    expectedRevision: data.revision, actualEndAt: null, ...reportFields(data.reports[0]?.payload, bookedServices),
    attendance: [], amendmentReason: '',
  }));
  const [actualGuests, setActualGuests] = useState(() => {
    const payload = data.reports[0]?.payload;
    const previousTotal = attendedTotal(data);
    // An old mixed-age draft records only a total; require classification rather than guessing.
    if (payload && !payload.actualGuests && !legacyTotalOnly && previousTotal !== bookedGuests.adults + bookedGuests.children + bookedGuests.infants && (bookedGuests.children || bookedGuests.infants)) {
      return { adults: '', children: '', infants: '' };
    }
    const initial = payload?.actualGuests ?? (payload && !bookedGuests.children && !bookedGuests.infants
      ? { adults: previousTotal, children: 0, infants: 0 } : bookedGuests);
    return { adults: String(initial.adults), children: String(initial.children), infants: String(initial.infants) };
  });
  const actualTotal = legacyTotalOnly ? attendedTotal(data) : Number(actualGuests.adults) + Number(actualGuests.children) + Number(actualGuests.infants);
  const [save, state] = useSaveCompletionMutation();
  const [uploadImage] = useUploadCompletionImageMutation();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const uploadInProgress = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const locked = !!data.completedAt && !amending;
  const ended = Date.parse(data.scheduledEndAt) <= Date.now();
  const hasPending = data.bookings.some(b => b.status === 'CONFIRMED');
  // participants is the checkout headcount: adults, children and infants, not the number of accounts.
  const booked = data.bookings.reduce((sum, b) => sum + b.participants, 0);

  const isGroupOverflow = (key: 'adults' | 'children' | 'infants') => {
    if (legacyTotalOnly) return false;
    const str = actualGuests[key]?.trim();
    if (!str) return false;
    const val = Number(str);
    return Number.isInteger(val) && val > bookedGuests[key];
  };

  const isGroupNegative = (key: 'adults' | 'children' | 'infants') => {
    if (legacyTotalOnly) return false;
    const str = actualGuests[key]?.trim();
    if (!str) return false;
    const val = Number(str);
    return !Number.isInteger(val) || val < 0;
  };

  const hasGroupOverflow = !legacyTotalOnly && (['adults', 'children', 'infants'] as const).some(isGroupOverflow);
  const hasGroupNegative = !legacyTotalOnly && (['adults', 'children', 'infants'] as const).some(isGroupNegative);
  const hasInputErrors = hasGroupOverflow || hasGroupNegative;

  const field = <K extends keyof CompletionReport,>(key: K, value: CompletionReport[K]) => setReport(r => ({ ...r, [key]: value }));
  const upload = async (files: File[]) => {
    if (!files.length || uploadInProgress.current) return;
    setError('');
    if (files.length + report.evidence.length > 20) { setError('Mỗi báo cáo được đính kèm tối đa 20 ảnh.'); return; }
    if (files.some(f => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024 || !f.size)) {
      setError('Chọn ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB.'); return;
    }
    uploadInProgress.current = true; setUploading(true);
    try {
      for (const file of files) {
        const result = await uploadImage(file).unwrap();
        if (!result.url.startsWith('https://')) throw new Error('Invalid upload URL');
        setReport(r => ({ ...r, evidence: [...r.evidence, result.url] }));
      }
    } catch (e) { setError(getTourApiMessage(e, 'Không thể tải ảnh. Các ảnh đã tải thành công vẫn được giữ; hãy chọn lại ảnh còn thiếu.')); }
    finally { uploadInProgress.current = false; setUploading(false); }
  };
  const persist = async (submit: boolean) => {
    if (uploadInProgress.current) return;
    setError(''); setFeedback('');
    const counts: GuestCounts = { adults: Number(actualGuests.adults), children: Number(actualGuests.children), infants: Number(actualGuests.infants) };
    if (!legacyTotalOnly && (['adults', 'children', 'infants'] as const).some(key => !actualGuests[key].trim() || !Number.isInteger(counts[key]) || counts[key] < 0 || counts[key] > bookedGuests[key])) {
      setError('Số khách thực tế phải là số nguyên từ 0 đến số đã đặt của từng nhóm.'); return;
    }
    if (submit && (report.serviceConfirmations ?? []).some(value => value.status === 'UNCONFIRMED')) { setError('Hãy xác nhận tất cả dịch vụ mua thêm trong booking.'); return; }
    if (submit && actualTotal < booked && (report.absenceReason?.trim().length ?? 0) < 10) { setError('Hãy ghi rõ lý do khách vắng mặt và phương án xử lý (ít nhất 10 ký tự).'); return; }
    try {
      const saved = await save({ tourId, departureId, report: { ...report, changes: report.noChanges ? '' : report.changes, incidents: report.noIncidents ? '' : report.incidents, actualParticipants: actualTotal, ...(!legacyTotalOnly ? { actualGuests: counts } : {}) }, submit }).unwrap();
      setReport(r => ({ ...r, expectedRevision: saved.revision }));
      setAmending(false);
      setFeedback(submit ? (data.completedAt ? 'Đã gửi bản bổ sung.' : 'Đã gửi báo cáo và hoàn tất chuyến đi.') : 'Đã lưu bản nháp.');
    } catch (e) { setError(getTourApiMessage(e, 'Không thể lưu báo cáo. Nội dung bạn nhập vẫn được giữ.')); }
  };
  if (!hasPending && !data.completedAt) return <p className="text-sm text-slate-700">Chuyến đi đã hoàn tất theo luồng cũ, chưa có báo cáo Agency.</p>;
  return <div className="space-y-6">
    <p className="text-sm leading-6 text-slate-600">
      Thông tin chuyến đi được tự động tổng hợp từ dữ liệu tour và đơn đặt chỗ. Báo cáo này là cơ sở quan trọng để đối soát tài chính, đánh giá chất lượng dịch vụ và bảo vệ quyền lợi của Agency.
    </p>
    <form onSubmit={e => { e.preventDefault(); void persist(true); }} className="space-y-6">
      <fieldset disabled={locked || state.isLoading || uploading} className="min-w-0 space-y-7 disabled:opacity-80">
        <section aria-labelledby="completion-guests-title" className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 id="completion-guests-title" className="text-sm font-semibold text-slate-900">1. Số khách tham gia</h3>
            <p className="mt-0.5 text-xs text-slate-500">Đối chiếu số lượng khách thực tế tham gia theo từng phân loại độ tuổi so với dữ liệu đã đặt ban đầu.</p>
          </div>
          <table className="w-full text-sm"><thead><tr className="text-slate-600"><th scope="col" className="px-4 py-3 text-left font-medium">Nhóm khách</th><th scope="col" className="px-3 py-3 text-center font-medium">Đã đặt</th><th scope="col" className="px-4 py-3 text-right font-medium">Thực tế</th></tr></thead>
            <tbody>{([{ key: 'adults', label: 'Người lớn' }, { key: 'children', label: 'Trẻ em' }, { key: 'infants', label: 'Em bé' }] as const).map(group => <tr key={group.key} className="border-t border-slate-100">
              <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800">{group.label}</th><td className="px-3 py-3 text-center tabular-nums text-slate-700">{bookedGuests[group.key]}</td>
              <td className="px-4 py-2 text-right">
                {legacyTotalOnly ? <span className="text-slate-500">—</span> : (
                  <div className="inline-flex flex-col items-end">
                    <input
                      aria-label={`${group.label} thực tế`}
                      type="number"
                      min={0}
                      max={bookedGuests[group.key]}
                      step={1}
                      required
                      className={`min-h-10 w-20 rounded-lg border px-3 py-2 text-right tabular-nums focus:outline-none focus:ring-2 sm:w-24 ${
                        isGroupOverflow(group.key) || isGroupNegative(group.key)
                          ? 'border-red-500 bg-red-50/60 text-red-900 focus:border-red-600 focus:ring-red-200'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-teal-700 focus:ring-teal-700/20'
                      }`}
                      value={actualGuests[group.key]}
                      onChange={e => setActualGuests(counts => ({ ...counts, [group.key]: e.target.value }))}
                    />
                    {isGroupOverflow(group.key) && (
                      <span className="mt-1 text-[11px] font-semibold text-red-600">
                        Tối đa {bookedGuests[group.key]}
                      </span>
                    )}
                    {isGroupNegative(group.key) && (
                      <span className="mt-1 text-[11px] font-semibold text-red-600">
                        Số nguyên &ge; 0
                      </span>
                    )}
                  </div>
                )}
              </td>
            </tr>)}</tbody>
            <tfoot className="border-t border-teal-100 bg-teal-50 text-teal-900"><tr><th scope="row" className="px-4 py-3 text-left font-bold">Tổng cộng</th><td className="px-3 py-3 text-center font-bold tabular-nums">{booked}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{Number.isFinite(actualTotal) ? actualTotal : '—'}</td></tr></tfoot>
          </table>
        </section>
        {hasGroupOverflow ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-sm text-red-800">
            <AlertTriangle className="size-4 shrink-0 text-red-600" />
            <span><strong>Cảnh báo số lượng:</strong> Có nhóm khách thực tế vượt quá số lượng đã đặt ban đầu. Vui lòng kiểm tra và sửa lại.</span>
          </div>
        ) : hasGroupNegative ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-sm text-red-800">
            <AlertTriangle className="size-4 shrink-0 text-red-600" />
            <span>Số khách thực tế của từng nhóm phải là số nguyên không âm.</span>
          </div>
        ) : legacyTotalOnly ? (
          <p className="text-sm text-slate-600">Báo cáo cũ chỉ ghi nhận tổng khách thực tế, chưa phân loại độ tuổi.</p>
        ) : actualTotal < booked ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-sm text-amber-900">
            <span className="flex items-center gap-2 font-medium">
              <AlertCircle className="size-4 shrink-0 text-amber-600" />
              Số khách vắng mặt: <strong className="text-amber-950">{booked - actualTotal} người</strong> (tự động tính).
            </span>
            <span className="text-xs font-semibold text-amber-700">Cần nhập giải trình tại Mục 5 bên dưới</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>Toàn bộ {booked} khách đã tham gia đầy đủ chuyến đi.</span>
          </div>
        )}
        <div>
          <label htmlFor="completion-summary" className="block text-sm font-semibold">2. Tổng kết chuyến đi</label>
          <p id="completion-summary-hint" className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Tóm tắt tiến trình tour, các điểm đến đã tham quan, trải nghiệm thực tế của du khách và đánh giá chung về chuyến đi (tối thiểu 20 ký tự).
          </p>
          <textarea
            id="completion-summary"
            aria-describedby="completion-summary-hint"
            className={agencyInput}
            rows={4}
            required
            minLength={20}
            maxLength={10000}
            placeholder="Ví dụ: Đoàn khởi hành đúng giờ, thời tiết thuận lợi. Hoàn thành 100% các điểm tham quan theo kế hoạch. Du khách hào hứng, phản hồi tích cực về hướng dẫn viên và bữa ăn..."
            value={report.summary}
            onChange={e => field('summary', e.target.value)}
          />
        </div>
        <div>
          <h3 id="completion-changes-title" className="text-sm font-semibold">3. Thay đổi so với kế hoạch</h3>
          <label className="mt-3 inline-flex min-h-8 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={report.noChanges} onChange={e => field('noChanges', e.target.checked)} />
            Không có thay đổi
          </label>
          <p id="completion-changes-hint" className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Ghi nhận mọi sự điều chỉnh về lộ trình, thời gian hoặc dịch vụ phát sinh ngoài chương trình đã công bố kèm lý do cụ thể.
          </p>
          {!report.noChanges && (
            <textarea
              id="completion-changes"
              aria-labelledby="completion-changes-title"
              aria-describedby="completion-changes-hint"
              className={agencyInput}
              rows={3}
              required
              minLength={10}
              maxLength={10000}
              placeholder="Mô tả cụ thể nội dung thay đổi, lý do (thời tiết, giao thông, an toàn...) và phương án thay thế đã được du khách đồng thuận..."
              value={report.changes}
              onChange={e => field('changes', e.target.value)}
            />
          )}
        </div>
        <section aria-labelledby="completion-services-title">
          <h3 id="completion-services-title" className="text-sm font-semibold">4. Xác nhận dịch vụ</h3>
          <p className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Đối soát và xác nhận tình trạng cung cấp thực tế của các dịch vụ mua thêm trong booking để làm căn cứ quyết toán.
          </p>
          {bookedServices.length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">{bookedServices.map(service => <div key={service.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1"><label htmlFor={`completion-service-${service.key}`} className="break-words text-sm font-medium">{service.name}</label><p className="mt-1 text-xs text-slate-600">Đã đặt {service.quantity}{service.unit ? ` ${service.unit}` : ''} · {service.bookingCount} booking</p></div>
            <select id={`completion-service-${service.key}`} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-teal-700 sm:w-44" value={report.serviceConfirmations?.find(s => s.key === service.key)?.status ?? 'UNCONFIRMED'} onChange={e => field('serviceConfirmations', bookedServices.map(item => ({ key: item.key, status: item.key === service.key ? e.target.value as ExtraServiceStatus : report.serviceConfirmations?.find(s => s.key === item.key)?.status ?? 'UNCONFIRMED' })))}>
              {Object.entries(serviceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>)}</div> : <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Không có dịch vụ mua thêm trong các booking của chuyến đi.</p>}
        </section>
        <div>
          <h3 id="completion-absence-title" className="text-sm font-semibold">5. Khách vắng mặt</h3>
          <p id="completion-absence-hint" className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Ghi nhận nguyên nhân và phương án xử lý đối với du khách không tham gia để đối soát quyền lợi và giải quyết khiếu nại (nếu có).
          </p>
          {hasInputErrors ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-center gap-2 font-bold text-red-900">
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
                <span>Dữ liệu số khách ở Mục 1 không hợp lệ</span>
              </div>
              <p className="mt-1 text-xs text-red-700">
                Có nhóm khách thực tế vượt quá số đã đặt. Vui lòng điều chỉnh lại bảng số lượng khách tại Mục 1 để hệ thống tính chính xác số khách vắng mặt.
              </p>
            </div>
          ) : actualTotal < booked ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    <span>{booked - actualTotal} khách vắng mặt (No-show)</span>
                  </div>
                  <span className="text-xs font-semibold text-amber-700">Bắt buộc giải trình (tối thiểu 10 ký tự)</span>
                </div>
                
                {/* Breakdown theo từng nhóm vắng */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-amber-900">Chi tiết vắng mặt:</span>
                  {bookedGuests.adults > Number(actualGuests.adults) && (
                    <span className="rounded-md border border-amber-200 bg-white px-2 py-0.5 font-medium text-amber-900 shadow-2xs">
                      Người lớn: vắng <strong>{bookedGuests.adults - Number(actualGuests.adults)}</strong> / {bookedGuests.adults}
                    </span>
                  )}
                  {bookedGuests.children > Number(actualGuests.children) && (
                    <span className="rounded-md border border-amber-200 bg-white px-2 py-0.5 font-medium text-amber-900 shadow-2xs">
                      Trẻ em: vắng <strong>{bookedGuests.children - Number(actualGuests.children)}</strong> / {bookedGuests.children}
                    </span>
                  )}
                  {bookedGuests.infants > Number(actualGuests.infants) && (
                    <span className="rounded-md border border-amber-200 bg-white px-2 py-0.5 font-medium text-amber-900 shadow-2xs">
                      Em bé: vắng <strong>{bookedGuests.infants - Number(actualGuests.infants)}</strong> / {bookedGuests.infants}
                    </span>
                  )}
                </div>

                {/* Danh sách booking đối chiếu */}
                {!!data.bookings.length && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-amber-200/60 pt-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Mã booking trong đoàn:</span>
                    {data.bookings.map(b => (
                      <span key={b.id} className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 border border-slate-200 shadow-2xs">
                        {b.bookingCode} ({b.participants} khách)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick chips lý do vắng mặt */}
              {!locked && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Sparkles className="size-3.5 text-teal-600" />
                    <span>Gợi ý lý do nhanh (nhấp để thêm vào nội dung):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Khách không đến (No-show), không liên lạc được',
                      'Khách hủy sát giờ khởi hành (không hoàn tiền)',
                      'Khách gặp vấn đề sức khỏe đột xuất',
                      'Trễ chuyến bay / phương tiện di chuyển cá nhân',
                      'Đã hỗ trợ bảo lưu vé sang đợt khởi hành sau',
                    ].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 px-2.5 py-1 text-xs text-slate-700 transition-colors cursor-pointer"
                        onClick={() => {
                          const current = report.absenceReason?.trim() ?? '';
                          const updated = current ? `${current}\n• ${tag}` : `• ${tag}`;
                          field('absenceReason', updated);
                        }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                id="completion-absence"
                aria-labelledby="completion-absence-title"
                aria-describedby="completion-absence-hint"
                className={agencyInput}
                rows={3}
                required
                minLength={10}
                maxLength={10000}
                placeholder="Ghi rõ mã booking hoặc danh tính khách vắng mặt, nguyên nhân cụ thể và phương án đã xử lý..."
                value={report.absenceReason}
                onChange={e => field('absenceReason', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>Không có khách vắng mặt. Toàn bộ {booked} khách tham gia đầy đủ chuyến đi.</span>
            </div>
          )}
        </div>
        <div>
          <h3 id="completion-incidents-title" className="text-sm font-semibold">6. Sự cố và cách xử lý</h3>
          <label className="mt-3 inline-flex min-h-8 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={report.noIncidents} onChange={e => field('noIncidents', e.target.checked)} />
            Không có sự cố
          </label>
          <p id="completion-incidents-hint" className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Ghi nhận các tình huống phát sinh ngoài ý muốn (sức khỏe du khách, sự cố phương tiện, mất mát hành lý) và cách thức giải quyết tại chỗ.
          </p>
          {!report.noIncidents && (
            <textarea
              id="completion-incidents"
              aria-labelledby="completion-incidents-title"
              aria-describedby="completion-incidents-hint"
              className={agencyInput}
              rows={3}
              required
              minLength={10}
              maxLength={10000}
              placeholder="Ghi rõ thời điểm xảy ra sự cố, nội dung, biện pháp xử lý và kết quả thỏa thuận với khách..."
              value={report.incidents}
              onChange={e => field('incidents', e.target.value)}
            />
          )}
        </div>
        <section aria-labelledby="completion-evidence-title" className="space-y-3">
          <div>
            <h3 id="completion-evidence-title" className="text-sm font-semibold">7. Hình ảnh và tài liệu đính kèm</h3>
            <p id="completion-evidence-hint" className="mt-1 text-sm leading-5 text-slate-600">
              Tải ảnh minh chứng từ máy (không bắt buộc). Hỗ trợ JPG, PNG, WebP; tối đa 20 ảnh, mỗi ảnh 5 MB.
            </p>
          </div>

          {/* Current Images List (chuẩn giao diện thêm ảnh tạo tour) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-800">
                Ảnh đã thêm ({report.evidence.length})
              </span>
              <span className="text-xs text-slate-500">
                {locked ? 'Danh sách ảnh minh chứng đã lưu' : 'Rê chuột vào ảnh để xem chi tiết hoặc xóa'}
              </span>
            </div>

            {report.evidence.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/60">
                <p className="text-sm font-bold text-slate-700">Chưa có ảnh minh chứng nào</p>
                <p className="text-xs text-slate-500 mt-1">
                  {locked ? 'Không có ảnh nào được đính kèm trong báo cáo này.' : 'Hãy tải ảnh chụp thực tế chuyến đi từ máy tính bên dưới.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {report.evidence.map((imgUrl, idx) => (
                  <div key={`${imgUrl}:${idx}`} className="group/item relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                    <img src={imgUrl} alt={`Ảnh minh chứng ${idx + 1}`} className="size-full object-cover" />
                    <span className="absolute top-2 left-2 rounded-md bg-[#087e8b] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                      Ảnh {idx + 1}
                    </span>
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`Xem ảnh ${idx + 1}`}
                        className="rounded-lg bg-white/90 p-2 text-xs font-bold text-slate-800 hover:bg-white shadow-sm cursor-pointer inline-flex items-center justify-center"
                      >
                        <ExternalLink size={16} />
                      </a>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => field('evidence', report.evidence.filter((_, index) => index !== idx))}
                          title={`Bỏ ảnh ${idx + 1}`}
                          aria-label={`Bỏ ảnh ${idx + 1}`}
                          className="rounded-lg bg-rose-600 p-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm cursor-pointer inline-flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thêm ảnh mới - Dropzone & PC upload matching AgencyTourEditorPage */}
          {!locked && report.evidence.length < 20 && (
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Thêm ảnh mới
              </span>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = Array.from(e.dataTransfer.files ?? []);
                  void upload(files);
                }}
                className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? 'border-teal-600 bg-teal-50/70'
                    : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-slate-50'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="size-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700 mb-2" />
                    <p className="text-xs font-bold text-teal-800">Đang tải ảnh lên...</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Vui lòng chờ trong giây lát</p>
                  </div>
                ) : (
                  <>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-100/70 text-teal-700 mb-2.5 group-hover:scale-105 transition-transform">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Kéo & thả ảnh vào đây, hoặc
                    </p>
                    <label
                      htmlFor="completion-evidence-file-input"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 cursor-pointer transition-colors shadow-2xs"
                    >
                      <FolderOpen size={16} />
                      <span>Tải ảnh từ máy tính</span>
                    </label>
                    <input
                      id="completion-evidence-file-input"
                      aria-label="Tải ảnh từ máy"
                      aria-describedby="completion-evidence-hint"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      disabled={uploading || report.evidence.length >= 20}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        void upload(files);
                      }}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Hỗ trợ định dạng JPG, PNG, WebP (Tối đa 5MB · Tối đa 20 ảnh)
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
        <div>
          <label htmlFor="completion-notes" className="block text-sm font-semibold">8. Ghi chú bổ sung</label>
          <p id="completion-notes-hint" className="mb-3 mt-1 text-sm leading-5 text-slate-600">
            Ý kiến đóng góp, đề xuất nâng cấp chất lượng tour hoặc lưu ý đặc biệt cho bộ phận điều hành (không bắt buộc).
          </p>
          <textarea
            id="completion-notes"
            aria-describedby="completion-notes-hint"
            className={agencyInput}
            rows={3}
            maxLength={10000}
            placeholder="Nhập các ghi chú thêm nếu có..."
            value={report.additionalNotes}
            onChange={e => field('additionalNotes', e.target.value)}
          />
        </div>
        {amending && <div><label htmlFor="completion-amendment" className="mb-2 block text-sm font-medium">Lý do bổ sung</label>
          <textarea id="completion-amendment" className={agencyInput} minLength={10} maxLength={2000} required value={report.amendmentReason} onChange={e => field('amendmentReason', e.target.value)} /></div>}
      </fieldset>
      {!locked && <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white py-4">
        {!data.completedAt && <button type="button" className={agencyButton} disabled={state.isLoading || uploading || !hasPending} onClick={() => void persist(false)}>Lưu nháp</button>}
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700 bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state.isLoading || uploading || !ended || (!data.completedAt && !hasPending)}>{state.isLoading ? 'Đang lưu…' : amending ? 'Gửi bản bổ sung' : 'Gửi báo cáo & hoàn tất'}</button>
        {amending && <button type="button" className={agencyButton} disabled={state.isLoading || uploading} onClick={() => {
          const previous = data.reports[0]?.payload;
          setReport(r => ({ ...r, ...reportFields(previous, bookedServices), amendmentReason: '' }));
          const counts = previous?.actualGuests ?? (!bookedGuests.children && !bookedGuests.infants ? { adults: attendedTotal(data), children: 0, infants: 0 } : bookedGuests);
          setActualGuests({ adults: String(counts.adults), children: String(counts.children), infants: String(counts.infants) });
          setAmending(false); setError('');
        }}>Hủy bổ sung</button>}
      </div>}
    </form>
    {locked && <button type="button" className={agencyButton} onClick={() => {
      if (legacyTotalOnly && (bookedGuests.children || bookedGuests.infants)) setActualGuests({ adults: '', children: '', infants: '' });
      setAmending(true);
    }}>Bổ sung báo cáo</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {feedback && <p role="status" className="text-sm text-teal-800">{feedback}</p>}
  </div>;
}

function ReportContent({ tourId, departureId }: { tourId: string; departureId: string }) {
  const query = useDepartureCompletionQuery({ tourId, departureId }, { refetchOnMountOrArgChange: true });
  return <div className="pt-3 text-slate-900">
      {query.isFetching && !query.currentData ? <AgencyLoading /> : query.error ? <AgencyError message={getTourApiMessage(query.error, 'Không thể tải báo cáo.')} retry={() => void query.refetch()} />
        : query.currentData && <ReportForm key={`${tourId}:${departureId}`} data={query.currentData} tourId={tourId} departureId={departureId} />}
  </div>;
}
export function AgencyCompletionReportModal({ scope, onClose }: { scope: { tourId: string; departureId: string } | null; onClose: () => void }) {
  const member = useAppSelector(selectActiveAgency);
  const permission = useAgencyPermission('tour:update-own');
  return <Modal open={!!scope} title={<h2 className="m-0 text-xl font-bold text-slate-900">Báo cáo chuyến đi</h2>} width={800} footer={null} onCancel={onClose} maskClosable={false} destroyOnClose
    styles={{ body: { maxHeight: '75vh', overflowY: 'auto', paddingRight: 4 } }}>
    {scope && (permission && ['OWNER', 'MANAGER'].includes(member?.memberRole ?? '') ? <ReportContent key={`${scope.tourId}:${scope.departureId}`} {...scope} /> : <AgencyDenied />)}
  </Modal>;
}
