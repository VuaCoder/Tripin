'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { ConfigProvider, DatePicker, InputNumber, Switch, TimePicker } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { Banknote, CalendarDays, Clock3, LockKeyhole, Trash2, Users, Repeat2, Check, LoaderCircle } from 'lucide-react';
import { guestTotal, resolveGuestGroupCounts, type AgePricing, type GuestCounts } from '@travel-platform/constants';
import { Modal } from '@/components/ui/Modal';
import { GuestGroupDropdown } from '@/components/ui/GuestGroupDropdown';
import { TourPhoto } from './TourCatalog';
import { atVietnam, localParts, todayVietnam, weeklyDates } from './calendarTime';
import type { CalendarTour, DepartureEvent } from './types';
import styles from './calendar.module.css';

dayjs.locale('vi');

const DEPARTURE_COUNTS_KEY_PREFIX = 'tripri_departure_guest_counts:';

function readDepartureGuestCounts(event: DepartureEvent | undefined, tour: CalendarTour): GuestCounts {
  const totalCapacity = event?.capacity ?? tour.maxGroupSize ?? 10;
  const pricing = tour.agePricing as AgePricing | null | undefined;
  if (event && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`${DEPARTURE_COUNTS_KEY_PREFIX}${event.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { capacity?: number; counts?: GuestCounts };
        const counts = parsed?.counts;
        if (
          parsed?.capacity === event.capacity &&
          counts &&
          Number.isInteger(counts.adults) && counts.adults >= 0 &&
          Number.isInteger(counts.children) && counts.children >= 0 &&
          Number.isInteger(counts.infants) && counts.infants >= 0 &&
          guestTotal(counts) === event.capacity
        ) {
          return counts;
        }
      }
    } catch {
      // Ignore malformed storage entries and fall back to tour breakdown.
    }
  }
  return resolveGuestGroupCounts(totalCapacity, pricing);
}

function writeDepartureGuestCounts(eventId: string, capacity: number, counts: GuestCounts) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${DEPARTURE_COUNTS_KEY_PREFIX}${eventId}`, JSON.stringify({ capacity, counts }));
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

export interface EditorDraft { tour: CalendarTour; date: string; weekly?: boolean; event?: DepartureEvent }
export interface EditorValues { dates: string[]; capacity: number; priceOverride: number | null; isOpen: boolean }

export function ScheduleEditor({
  draft,
  busy,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  draft: EditorDraft;
  busy: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSave: (values: EditorValues) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const baseId = useId();
  const dayId = `${baseId}-day`;
  const timeId = `${baseId}-time`;
  const untilId = `${baseId}-until`;
  const capacityId = `${baseId}-capacity`;
  const priceId = `${baseId}-price`;
  const switchId = `${baseId}-open`;

  const parts = localParts(draft.date);
  const [day, setDay] = useState(parts.day);
  const [time, setTime] = useState(parts.time);
  const [until, setUntil] = useState(new Date(Date.parse(parts.day + 'T12:00:00Z') + 28 * 86_400_000).toISOString().slice(0, 10));
  const [weekdays, setWeekdays] = useState([new Date(parts.day + 'T12:00:00Z').getUTCDay() || 7]);
  const [guestCounts, setGuestCounts] = useState<GuestCounts>(() => readDepartureGuestCounts(draft.event, draft.tour));
  const [price, setPrice] = useState<number | null>(draft.event?.priceOverride ?? null);
  const [isOpen, setIsOpen] = useState(draft.event?.isOpen ?? true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const capacity = guestTotal(guestCounts);
  const booked = draft.event ? draft.event.capacity - draft.event.remaining : 0;
  const past = !!draft.event && Date.parse(draft.event.date) <= Date.now();
  const readOnly = !canEdit || past;
  const minDay = todayVietnam();
  const formattedBasePrice = new Intl.NumberFormat('vi-VN').format(draft.tour.basePrice);

  const lockBanner = useMemo(() => {
    if (past && booked > 0) return `Đã khởi hành · Có ${booked} khách đã đặt · Chế độ chỉ xem`;
    if (past) return 'Đã khởi hành · Chế độ chỉ xem';
    if (booked > 0) return `Đã có ${booked} khách đặt · Không thể thay đổi ngày và giờ khởi hành`;
    return '';
  }, [past, booked]);

  const preview = useMemo(() => {
    try {
      return { dates: draft.weekly ? weeklyDates(day, until, weekdays, time) : [atVietnam(day, time)], error: '' };
    } catch (caught) {
      return { dates: [], error: caught instanceof Error ? caught.message : 'Ngày giờ chưa hợp lệ.' };
    }
  }, [draft.weekly, day, until, weekdays, time]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (preview.error) return setError(preview.error);
    if (capacity < Math.max(1, booked)) return setError(`Sức chứa tối thiểu là ${Math.max(1, booked)} khách.`);
    if (preview.dates.some((date) => Date.parse(date) <= Date.now()) && !draft.event) return setError('Vui lòng chọn ngày và giờ trong tương lai.');
    try {
      await onSave({ dates: preview.dates, capacity, priceOverride: price, isOpen });
      if (draft.event) {
        writeDepartureGuestCounts(draft.event.id, capacity, guestCounts);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được. Vui lòng thử lại.');
    }
  };

  return (
    <Modal
      open
      title={draft.weekly ? 'Lịch lặp hàng tuần' : draft.event ? 'Sửa lịch' : 'Thêm lịch'}
      onClose={() => { if (!busy) onClose(); }}
      className={styles.editorModal}
    >
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#087e8b',
            borderRadius: 8,
            controlHeight: 42,
          },
        }}
      >
        <form onSubmit={submit} className={styles.editor} aria-busy={busy}>
          <div className={styles.editorTour}>
            <TourPhoto src={draft.tour.coverImage} title={draft.tour.title} />
            <div>
              <h3>{draft.tour.title}</h3>
              <div>
                <span className={styles.pill}>{formattedBasePrice} ₫ / khách</span>
                {draft.event && (
                  <span className={styles.pill}>
                    <Users size={12} />
                    {booked}/{draft.event.capacity} khách
                  </span>
                )}
              </div>
            </div>
          </div>

          {lockBanner && (
            <div role={past ? 'status' : undefined} className={styles.lockNotice}>
              <LockKeyhole size={16} />
              <span>{lockBanner}</span>
            </div>
          )}

          <div className={styles.editorGrid}>
            <div className={styles.fieldGroup}>
              <label htmlFor={dayId} className={styles.fieldLabel}>
                <CalendarDays size={14} />
                <span>{draft.weekly ? 'Bắt đầu từ' : 'Ngày khởi hành'}</span>
              </label>
              <DatePicker
                id={dayId}
                format="DD/MM/YYYY"
                allowClear={false}
                placeholder="Chọn ngày"
                value={dayjs(day, 'YYYY-MM-DD')}
                disabled={readOnly || booked > 0 || busy}
                disabledDate={(current) => !!current && current.format('YYYY-MM-DD') < minDay}
                onChange={(val) => {
                  if (val) setDay(val.format('YYYY-MM-DD'));
                }}
                styles={{ popup: { root: { zIndex: 1100 } } }}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor={timeId} className={styles.fieldLabel}>
                <Clock3 size={14} />
                <span>Giờ khởi hành (VN)</span>
              </label>
              <TimePicker
                id={timeId}
                format="HH:mm"
                allowClear={false}
                needConfirm={false}
                placeholder="Chọn giờ"
                value={dayjs(time, 'HH:mm')}
                disabled={readOnly || booked > 0 || busy}
                onChange={(val) => {
                  if (val) setTime(val.format('HH:mm'));
                }}
                styles={{ popup: { root: { zIndex: 1100 } } }}
              />
            </div>
          </div>

          {draft.weekly && (
            <section className={styles.repeatBox}>
              <h3>
                <Repeat2 size={16} />
                Lặp vào các ngày
              </h3>
              <div className={styles.weekdays}>
                {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                  <button
                    key={weekday}
                    type="button"
                    aria-label={weekday === 7 ? 'Chủ nhật' : `Thứ ${weekday + 1}`}
                    aria-pressed={weekdays.includes(weekday)}
                    onClick={() =>
                      setWeekdays((previous) =>
                        previous.includes(weekday) ? previous.filter((item) => item !== weekday) : [...previous, weekday],
                      )
                    }
                    disabled={busy}
                  >
                    {weekday === 7 ? 'CN' : `T${weekday + 1}`}
                  </button>
                ))}
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor={untilId} className={styles.fieldLabel}>
                  <CalendarDays size={14} />
                  <span>Ngày kết thúc</span>
                </label>
                <DatePicker
                  id={untilId}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  placeholder="Chọn ngày kết thúc"
                  value={dayjs(until, 'YYYY-MM-DD')}
                  disabled={busy}
                  disabledDate={(current) => !!current && current.format('YYYY-MM-DD') < day}
                  onChange={(val) => {
                    if (val) setUntil(val.format('YYYY-MM-DD'));
                  }}
                  styles={{ popup: { root: { zIndex: 1100 } } }}
                />
              </div>
              <div className={styles.repeatPreview} aria-live="polite">
                <strong>{preview.dates.length} đợt khởi hành</strong>
                <div>
                  {preview.dates.slice(0, 8).map((date) => (
                    <span key={date}>
                      {new Intl.DateTimeFormat('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        day: '2-digit',
                        month: '2-digit',
                      }).format(new Date(date))}
                    </span>
                  ))}
                  {preview.dates.length > 8 && <span>+{preview.dates.length - 8}</span>}
                </div>
                {preview.error && (
                  <span role="alert" className={styles.errorText}>
                    {preview.error}
                  </span>
                )}
              </div>
            </section>
          )}

          <div className={styles.editorGrid}>
            <div className={styles.fieldGroup}>
              <label htmlFor={capacityId} className={styles.fieldLabel}>
                <Users size={14} />
                <span>Số lượng khách</span>
              </label>
              <GuestGroupDropdown
                id={capacityId}
                value={guestCounts}
                onChange={(next) => {
                  if (next) setGuestCounts(next);
                }}
                minTotal={Math.max(1, booked)}
                maxTotal={10_000}
                disabled={readOnly || busy}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor={priceId} className={styles.fieldLabel}>
                <Banknote size={14} />
                <span>Giá riêng (₫)</span>
              </label>
              <InputNumber<number>
                id={priceId}
                min={0}
                max={2_000_000_000}
                step={1000}
                controls={false}
                value={price}
                placeholder={formattedBasePrice}
                disabled={readOnly || busy}
                formatter={(val) => (val == null ? '' : `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
                parser={(val) => {
                  const digits = (val ?? '').replace(/\D+/g, '');
                  return digits ? Number(digits) : (null as unknown as number);
                }}
                onChange={(val) => setPrice(typeof val === 'number' ? val : null)}
              />
              <span className={styles.fieldHint}>Để trống để dùng giá gốc của tour</span>
            </div>
          </div>

          <div className={styles.switchCard}>
            <label htmlFor={switchId} className={styles.switchText}>
              <strong>Trạng thái mở bán</strong>
              <span>{isOpen ? 'Đang mở nhận khách đặt chỗ cho đợt này' : 'Đang tạm ngừng nhận khách'}</span>
            </label>
            <Switch
              id={switchId}
              checked={isOpen}
              disabled={readOnly || busy}
              onChange={(checked) => setIsOpen(checked)}
            />
          </div>

          {error && (
            <div role="alert" className={styles.inlineError}>
              {error}
            </div>
          )}

          {confirmDelete && (
            <div role="alert" className={styles.deleteConfirm}>
              <strong>Xóa đợt khởi hành này?</strong>
              <div>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Giữ lại
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await onDelete();
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : 'Không thể xóa.');
                    }
                  }}
                >
                  Xóa đợt
                </button>
              </div>
            </div>
          )}

          <div className={styles.editorActions}>
            {draft.event && !booked && !readOnly && (
              <button
                type="button"
                className={styles.deleteButton}
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} />
                Xóa
              </button>
            )}
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>
              Đóng
            </button>
            {!readOnly && (
              <button type="submit" className={styles.primaryButton} disabled={busy || !!preview.error}>
                {busy ? <LoaderCircle size={17} className={styles.spin} /> : <Check size={17} />}
                {draft.weekly ? `Tạo ${preview.dates.length} đợt` : 'Lưu'}
              </button>
            )}
          </div>
        </form>
      </ConfigProvider>
    </Modal>
  );
}
