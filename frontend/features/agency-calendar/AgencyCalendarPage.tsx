'use client';

import { useCallback, useRef, useState } from 'react';
import FullCalendar, { type CalendarRef, type DatesSetInfo, type EventDropInfo } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import classicTheme from '@fullcalendar/react/themes/classic';
import viLocale from '@fullcalendar/react/locales/vi';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Repeat2, PanelLeftOpen, LockKeyhole, LoaderCircle, X, Check, RotateCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAppSelector } from '@/store/hooks';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { AgencyDenied } from '@/features/agency/AgencyCommon';
import { agencyNotice } from '@/features/agency/agencyNotice';
import { getTourApiMessage } from '@/features/tours/api/toursApi';
import { TourCatalog, TourPhoto } from './TourCatalog';
import { ScheduleEditor, type EditorDraft, type EditorValues } from './ScheduleEditor';
import { useAgencyCalendarQuery, useCreateDeparturesMutation, useUpdateDepartureMutation, useDeleteDepartureMutation } from './api';
import { CALENDAR_ZONE, atVietnam, calendarInstant, endOfTour, localParts, maxConcurrentEvents, readRememberedTime, rememberTime, tomorrowVietnam, tourColor } from './calendarTime';
import type { CalendarTour, DepartureEvent, NewDeparture } from './types';
import styles from './calendar.module.css';

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, classicTheme];
type Chooser = { mode: 'slot' | 'single' | 'weekly'; date: string };

export default function AgencyCalendarPage() {
  const agency = useAppSelector(selectActiveAgency);
  const canView = !!agency?.permissions.includes('tour:update-own');
  const canEdit = !!agency?.permissions.includes('tour:set-availability');
  const apiRef = useRef<CalendarRef>(null);
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches ? 'timeGridDay' : 'dayGridMonth'));
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const calendar = useAgencyCalendarQuery(range ?? { from: '', to: '' }, { skip: !range || !canView, refetchOnFocus: true, refetchOnReconnect: true });
  const [createDepartures] = useCreateDeparturesMutation();
  const [updateDeparture] = useUpdateDepartureMutation();
  const [deleteDeparture] = useDeleteDepartureMutation();
  const [optimistic, setOptimistic] = useState<Record<string, DepartureEvent>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const setNotice = (notice: { error: boolean; message: string } | null) => {
    if (notice) agencyNotice[notice.error ? 'error' : 'success'](notice.message);
  };
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const retry = useRef<{ signature: string; departures: NewDeparture[] }>();
  const savedTime = () => readRememberedTime(agency!.agencyId);
  const defaultDate = () => atVietnam(tomorrowVietnam(), savedTime());
  const datesSet = useCallback((info: DatesSetInfo) => {
    setTitle(info.view.title);
    setView(info.view.type);
    setRange((previous) => previous?.from === info.startStr && previous.to === info.endStr ? previous : { from: info.startStr, to: info.endStr });
  }, []);
  if (!canView) return <AgencyDenied />;

  const records = new Map((calendar.currentData ?? []).map((item) => [item.id, item]));
  Object.values(optimistic).forEach((item) => records.set(item.id, item));
  removed.forEach((id) => records.delete(id));
  const values = Array.from(records.values());
  const visibleMaxConcurrent = (view === 'timeGridWeek' || view === 'timeGridDay') && range
    ? maxConcurrentEvents(values, range.from, range.to)
    : 1;
  const boardMinWidth = view === 'timeGridWeek'
    ? Math.max(980, 7 * Math.max(155, visibleMaxConcurrent * 145) + 64)
    : view === 'timeGridDay'
      ? Math.max(420, visibleMaxConcurrent * 185 + 64)
      : undefined;
  const refresh = async () => { const result = await calendar.refetch(); if (result.data) { setOptimistic({}); setRemoved([]); } };
  const fail = (caught: unknown) => {
    const message = getTourApiMessage(caught, caught instanceof Error ? caught.message : 'Không lưu được lịch. Vui lòng thử lại.');
    setNotice({ error: true, message });
    return new Error(message);
  };
  const create = async (tour: CalendarTour, form: EditorValues) => {
    const signature = JSON.stringify({ tourId: tour.id, ...form });
    if (retry.current?.signature !== signature) retry.current = { signature, departures: form.dates.map((date) => ({ id: crypto.randomUUID(), date, capacity: form.capacity, priceOverride: form.priceOverride, isOpen: form.isOpen })) };
    const departures = retry.current.departures;
    const temporary = departures.map((item): DepartureEvent => ({ ...item, tourId: tour.id, end: endOfTour(item.date, tour.durationDays), remaining: item.capacity, price: item.priceOverride ?? tour.basePrice, priceOverride: item.priceOverride ?? null, tour }));
    setSaving(true); setPending(departures.map((item) => item.id)); setNotice(null);
    setOptimistic(Object.fromEntries(temporary.map((item) => [item.id, item])));
    try {
      const result = await createDepartures({ tourId: tour.id, departures }).unwrap();
      setOptimistic(Object.fromEntries(result.events.map((item) => [item.id, item])));
      rememberTime(agency!.agencyId, localParts(form.dates[0]).time);
      retry.current = undefined;
      await refresh();
      setNotice({ error: false, message: result.skipped ? `Đã thêm ${result.created} đợt · Bỏ qua ${result.skipped} thời điểm đã có.` : result.replayed ? 'Lịch đã được lưu trước đó.' : `Đã thêm ${result.created} đợt khởi hành.` });
    } catch (caught) { setOptimistic({}); throw fail(caught); }
    finally { setSaving(false); setPending([]); }
  };
  const move = async (info: EventDropInfo) => {
    const current = records.get(info.event.id);
    if (!current || saving || !canEdit) { info.revert(); return; }
    let date: string;
    try {
      date = calendarInstant(
        info.event.startStr,
        info.view.type === 'dayGridMonth' || info.event.allDay,
        localParts(current.date).time,
      );
    } catch { info.revert(); return; }
    setOptimistic({ [current.id]: { ...current, date, end: endOfTour(date, current.tour.durationDays) } });
    setSaving(true); setPending([current.id]); setNotice(null);
    try {
      const result = await updateDeparture({ tourId: current.tourId, id: current.id, body: { expectedDate: current.date, date } }).unwrap();
      setOptimistic({ [result.id]: result });
      rememberTime(agency!.agencyId, localParts(date).time);
      await refresh();
      setNotice({ error: false, message: 'Đã cập nhật ngày và giờ khởi hành.' });
    } catch (caught) { info.revert(); setOptimistic({}); fail(caught); }
    finally { setSaving(false); setPending([]); }
  };
  const pick = (tour: CalendarTour) => {
    const selection = chooser;
    setChooser(null);
    if (selection?.mode === 'slot') {
      void create(tour, { dates: [selection.date], capacity: tour.maxGroupSize ?? 10, priceOverride: null, isOpen: true }).catch(() => undefined);
    } else setDraft({ tour, date: selection?.date ?? defaultDate(), weekly: selection?.mode === 'weekly' });
  };
  const saveDraft = async (form: EditorValues) => {
    if (!draft) return;
    if (draft.event) {
      const originalParts = localParts(draft.event.date);
      const selectedParts = localParts(form.dates[0]);
      const date = originalParts.day === selectedParts.day && originalParts.time === selectedParts.time ? draft.event.date : form.dates[0];
      setSaving(true); setPending([draft.event.id]);
      try {
        const row = await updateDeparture({ tourId: draft.event.tourId, id: draft.event.id, body: { expectedDate: draft.event.date, date, capacity: form.capacity, priceOverride: form.priceOverride, isOpen: form.isOpen } }).unwrap();
        setOptimistic({ [row.id]: row });
        rememberTime(agency!.agencyId, localParts(row.date).time);
        await refresh();
        setNotice({ error: false, message: 'Đã lưu đợt khởi hành.' });
      } catch (caught) { throw fail(caught); }
      finally { setSaving(false); setPending([]); }
    } else await create(draft.tour, form);
    setDraft(null);
  };
  const removeDraft = async () => {
    const row = draft?.event;
    if (!row) return;
    setSaving(true); setRemoved([row.id]);
    try {
      await deleteDeparture({ tourId: row.tourId, id: row.id, expectedDate: row.date }).unwrap();
      await refresh(); setDraft(null); setNotice({ error: false, message: 'Đã xóa đợt khởi hành.' });
    } catch (caught) { setRemoved([]); throw fail(caught); }
    finally { setSaving(false); }
  };
  return <main className={styles.page}>
    <header className={styles.pageHeader}><h1><CalendarDays size={27} />Lịch khởi hành</h1><div className={styles.headerActions}>{saving && <span role="status" className={styles.saving}><LoaderCircle size={15} className={styles.spin} />Đang lưu</span>}{canEdit && <><button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => setChooser({ mode: 'weekly', date: defaultDate() })}><Repeat2 size={17} /><span>Lặp hàng tuần</span></button><button type="button" className={styles.primaryButton} disabled={saving} onClick={() => setChooser({ mode: 'single', date: defaultDate() })}><Plus size={18} />Thêm lịch</button></>}</div></header>
    <div className={styles.workspace}>
      <aside className={styles.catalogDesktop} aria-label="Danh sách tour kéo thả"><TourCatalog onPick={pick} canDrag={canEdit && !saving} agencyId={agency!.agencyId} /></aside>
      <section className={styles.board} aria-label="Lịch khởi hành agency" aria-busy={calendar.isFetching}>
        <div className={styles.calendarToolbar}>
          <div className={styles.navigation}><button type="button" aria-label="Khoảng lịch trước" onClick={() => apiRef.current?.getApi().prev()}><ChevronLeft size={18} /></button><button type="button" aria-label="Khoảng lịch sau" onClick={() => apiRef.current?.getApi().next()}><ChevronRight size={18} /></button><button type="button" className={styles.todayButton} onClick={() => apiRef.current?.getApi().today()}>Hôm nay</button></div>
          <h2 aria-live="polite">{title}</h2>
          <div className={styles.viewTabs} aria-label="Chế độ xem lịch">{[['dayGridMonth', 'Tháng'], ['timeGridWeek', 'Tuần'], ['timeGridDay', 'Ngày']].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => apiRef.current?.getApi().changeView(id)}>{label}</button>)}</div>
        </div>
        <div className={styles.boardMeta}><span className={styles.zone}><span className={styles.zoneDot} />Giờ Việt Nam · UTC+7</span><div>{calendar.isFetching && <LoaderCircle size={14} className={styles.spin} />}<span>{values.length} đợt</span><button type="button" aria-label="Làm mới lịch" disabled={calendar.isFetching || !range} onClick={() => void refresh()}><RotateCw size={16} /></button>{canEdit && <button type="button" className={styles.mobileCatalogButton} onClick={() => setChooser({ mode: 'single', date: defaultDate() })}><PanelLeftOpen size={16} />Tour</button>}</div></div>
        {calendar.isError && <div role="alert" className={styles.inlineError}>{getTourApiMessage(calendar.error, 'Không tải được lịch. Vui lòng thử lại.')}<button type="button" onClick={() => void refresh()}>Thử lại</button></div>}
        <div
          className={styles.calendarSurface}
          style={boardMinWidth ? ({ ['--fc-board-min-width' as string]: `${boardMinWidth}px` }) : undefined}
        >
          <FullCalendar ref={apiRef} plugins={PLUGINS} locale={viLocale} timeZone={CALENDAR_ZONE} initialView={view} firstDay={1}
            headerToolbar={false} height={view === 'dayGridMonth' ? 'auto' : Math.min(720, Math.max(480, (typeof window !== 'undefined' ? window.innerHeight : 900) - 230))} nowIndicator dayMaxEvents={3} moreLinkClick="popover"
            editable={canEdit && !saving} eventDurationEditable={false} droppable={canEdit && !saving}
            allDayMaintainDuration snapDuration="00:30:00" slotDuration="01:00:00" scrollTime="07:00:00" slotMinTime="00:00:00" slotMaxTime="24:00:00"
            slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotEventOverlap={false} columnEventTitleSticky eventInnerClass={styles.eventInner}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} datesSet={datesSet}
            events={values.map((row) => {
              const color = tourColor(row.tourId);
              const editable = canEdit && row.capacity === row.remaining && Date.parse(row.date) > Date.now() && !saving;
              return { id: row.id, title: row.tour.title, start: row.date, end: row.end, allDay: false, startEditable: editable, durationEditable: false, color: row.isOpen ? color.background : '#eff1f2', contrastColor: row.isOpen ? color.text : '#536269', className: styles.calendarEvent, extendedProps: { record: row } };
            })}
            eventDidMount={(info) => {
              info.el.dataset.departureId = info.event.id;
              const row = info.event.extendedProps.record as DepartureEvent | undefined;
              if (row) {
                info.el.style.borderColor = row.isOpen ? tourColor(row.tourId).border : '#cdd4d6';
                info.el.setAttribute('aria-label', `${row.tour.title}, ${localParts(row.date).day} ${localParts(row.date).time}, ${row.capacity - row.remaining}/${row.capacity} khách`);
              }
            }}
            eventAllow={(dropInfo, event) => !!event && Date.parse(event.startStr) > Date.now() && dropInfo.start.getTime() > Date.now() && !saving}
            eventDrop={(info) => { void move(info); }}
            drop={(info) => {
              if (!canEdit || saving || !info.draggedEl.dataset.tour) return;
              const tour = JSON.parse(info.draggedEl.dataset.tour) as CalendarTour;
              const date = calendarInstant(info.dateStr, info.allDay, savedTime());
              if (Date.parse(date) <= Date.now()) { setNotice({ error: true, message: 'Vui lòng thả vào ngày và giờ trong tương lai.' }); return; }
              void create(tour, { dates: [date], capacity: tour.maxGroupSize ?? 10, priceOverride: null, isOpen: true }).catch(() => undefined);
            }}
            dateClick={(info) => {
              if (!canEdit || saving) return;
              const date = calendarInstant(info.dateStr, info.allDay, savedTime());
              if (Date.parse(date) <= Date.now()) { setNotice({ error: true, message: 'Vui lòng chọn ngày và giờ trong tương lai.' }); return; }
              setChooser({ mode: 'slot', date });
            }}
            eventClick={(info) => { const row = records.get(info.event.id); if (row && !saving) setDraft({ tour: row.tour, date: row.date, event: row }); }}
            eventContent={(info) => {
              const row = info.event.extendedProps.record as DepartureEvent | undefined;
              const locked = !!row && (row.remaining < row.capacity || !row.isOpen);
              const lockReason = row
                ? row.remaining < row.capacity
                  ? 'Đã có khách đặt (khóa đổi ngày/giờ)'
                  : !row.isOpen
                    ? 'Đợt khởi hành đang đóng nhận khách'
                    : ''
                : '';
              const summary = row
                ? `${row.tour.title} · ${localParts(row.date).time} · ${row.capacity - row.remaining}/${row.capacity} khách${!row.isOpen ? ' · Đóng nhận khách' : ''}${row.remaining < row.capacity ? ' · Đã có khách đặt (khóa đổi ngày/giờ)' : ''}`
                : info.event.title;
              return (
                <div className={styles.eventContent} title={summary}>
                  {row && <TourPhoto src={row.tour.coverImage} title={row.tour.title} className={styles.eventThumb} iconSize={13} />}
                  <div className={styles.eventBody}>
                    <div className={styles.eventTitle}>
                      {pending.includes(info.event.id) ? (
                        <LoaderCircle size={12} className={styles.spin} />
                      ) : locked ? (
                        <span title={lockReason} aria-label={lockReason} className={styles.eventLock}>
                          <LockKeyhole size={12} />
                        </span>
                      ) : (
                        <span className={styles.eventDot} />
                      )}
                      <strong>{info.event.title}</strong>
                    </div>
                    {row && (
                      <div className={styles.eventFacts}>
                        <span>{localParts(row.date).time}</span>
                        <span>{!row.isOpen ? 'Đã đóng' : `${row.capacity - row.remaining}/${row.capacity} khách`}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </section>
    </div>
    {chooser && <Modal open title={chooser.mode === 'weekly' ? 'Chọn tour tạo lịch lặp' : 'Chọn tour khởi hành'} onClose={() => setChooser(null)} className={styles.pickerModal}><TourCatalog onPick={pick} canDrag={false} agencyId={agency!.agencyId} /></Modal>}
    {draft && <ScheduleEditor key={`${draft.tour.id}-${draft.event?.id ?? draft.date}-${draft.weekly}`} draft={draft} busy={saving} canEdit={canEdit} onClose={() => setDraft(null)} onSave={saveDraft} onDelete={removeDraft} />}
  </main>;
}
