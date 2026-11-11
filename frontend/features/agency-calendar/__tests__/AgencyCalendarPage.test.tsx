import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyCalendarPage from '../AgencyCalendarPage';

const mocks = vi.hoisted(() => {
  const futureDay = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const nextDay = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const makeEvent = (id: string, title: string, time = '08:00') => ({
    id,
    tourId: `tour-${id}`,
    date: `${futureDay}T${time}:00+07:00`,
    end: `${nextDay}T${time}:00+07:00`,
    capacity: 20,
    remaining: 18,
    price: 1500000,
    priceOverride: null,
    isOpen: true,
    tour: {
      id: `tour-${id}`,
      title,
      durationDays: 2,
      basePrice: 1500000,
      coverImage: null,
      status: 'APPROVED',
      maxGroupSize: 20,
      agePricing: null,
    },
  });
  const events = [makeEvent('1', 'Tour Đà Nẵng 1'), makeEvent('2', 'Tour Đà Nẵng 2', '09:00')];
  return {
    events,
    refetch: vi.fn().mockResolvedValue({ data: events }),
    createUnwrap: vi.fn().mockResolvedValue({ created: 1, skipped: 0, replayed: false, events: [events[0]] }),
    updateUnwrap: vi.fn().mockResolvedValue(events[0]),
    deleteUnwrap: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({ id: 'user-1', role: 'AGENCY', permissions: ['tour:update-own', 'tour:set-availability'] }),
}));
vi.mock('@/features/agency/agencyNotice', () => ({ agencyNotice: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/tours/api/toursApi', () => ({
  useGetAgencyToursQuery: () => ({
    currentData: {
      items: [{ id: 'tour-1', title: 'Tour Đà Nẵng 1', durationDays: 2, basePrice: 1500000, maxGroupSize: 20, images: [], status: 'APPROVED' }],
      meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
    },
    isFetching: false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  getTourApiMessage: (_err: unknown, fallback: string) => fallback,
}));
vi.mock('../api', () => ({
  useAgencyCalendarQuery: () => ({
    currentData: mocks.events,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  }),
  useCreateDeparturesMutation: () => [() => ({ unwrap: mocks.createUnwrap })],
  useUpdateDepartureMutation: () => [() => ({ unwrap: mocks.updateUnwrap })],
  useDeleteDepartureMutation: () => [() => ({ unwrap: mocks.deleteUnwrap })],
}));

describe('AgencyCalendarPage', () => {
  afterEach(cleanup);

  it('switches across Month, Week, and Day views cleanly without scrollgrid or removeChild errors and opens/saves ScheduleEditor', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener('error', onError);

    render(
      <StrictMode>
        <AgencyCalendarPage />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Tuần' })).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tuần' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('00:00')).toBeDefined();
    expect(screen.getByText('01:00')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ngày' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ngày' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('00:00')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Khoảng lịch sau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tháng' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tháng' }).getAttribute('aria-pressed')).toBe('true'));

    fireEvent.click(screen.getByRole('button', { name: /Lặp hàng tuần/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    const weeklyTourButtons = screen.getAllByRole('button', { name: 'Xếp lịch Tour Đà Nẵng 1' });
    fireEvent.click(weeklyTourButtons[weeklyTourButtons.length - 1]);
    await waitFor(() => expect(screen.getByRole('button', { name: /Tạo \d+ đợt/i })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const eventEl = document.querySelector('[data-departure-id="1"]') as HTMLElement;
    expect(eventEl).not.toBeNull();
    fireEvent.click(eventEl);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Số lượng khách' })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Số lượng khách' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  }, 15000);
});

