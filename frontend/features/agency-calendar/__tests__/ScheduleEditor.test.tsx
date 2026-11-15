import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleEditor } from '../ScheduleEditor';
import type { CalendarTour, DepartureEvent } from '../types';

const baseTour: CalendarTour = {
  id: 'tour-1',
  title: 'Tour Đà Nẵng 3N2Đ',
  durationDays: 3,
  basePrice: 2_500_000,
  maxGroupSize: 18,
  agePricing: {
    childMinAge: 2,
    adultMinAge: 13,
    childPercent: 100,
    infantPercent: 100,
    adultMaxCount: 10,
    childMaxCount: 5,
    infantMaxCount: 3,
  },
};

function futureIso(daysAhead = 5, time = '08:30') {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  const ymd = date.toISOString().slice(0, 10);
  return `${ymd}T${time}:00+07:00`;
}

describe('ScheduleEditor', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('renders Ant Design date and time pickers and initializes capacity from tour maxGroupSize', () => {
    const { container } = render(
      <ScheduleEditor
        draft={{ tour: baseTour, date: futureIso() }}
        busy={false}
        canEdit
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[type="time"]')).toBeNull();
    expect(screen.getByLabelText('Ngày khởi hành')).toBeDefined();
    expect(screen.getByLabelText('Giờ khởi hành (VN)')).toBeDefined();

    const capacityInput = screen.getByRole('spinbutton', { name: 'Số lượng khách (Sức chứa)' }) as HTMLInputElement;
    expect(capacityInput.value).toBe('18');
  });

  it('allows adjusting capacity and submits updated capacity', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const event: DepartureEvent = {
      id: 'dep-1',
      tourId: baseTour.id,
      date: futureIso(),
      end: futureIso(8),
      capacity: 18,
      remaining: 16,
      price: 2_500_000,
      priceOverride: null,
      isOpen: true,
      tour: baseTour,
    };

    render(
      <ScheduleEditor
        draft={{ tour: baseTour, date: event.date, event }}
        busy={false}
        canEdit
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const capacityInput = screen.getByRole('spinbutton', { name: 'Số lượng khách (Sức chứa)' });
    fireEvent.change(capacityInput, { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ capacity: 25 })));
    expect(window.localStorage.getItem('tripri_departure_guest_counts:dep-1')).toBeNull();
  });
});

