import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTourRequestDto } from '../types';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  list: { data: undefined as { items: CustomTourRequestDto[] } | undefined, isError: false, refetch: vi.fn() },
  save: vi.fn(),
  sendOffer: vi.fn(),
  accept: vi.fn(),
  decide: vi.fn(),
  tourRefetch: vi.fn(),
  tour: {
    id: 'pt1',
    title: 'Tour đoàn Đà Nẵng 3N2Đ',
    destination: 'Đà Nẵng',
    durationDays: 3,
    basePrice: 1_500_000,
    categoryIds: ['cat1'],
    images: [],
    inclusions: [],
    exclusions: [],
    agePricing: null,
    departures: [{ id: 'd1', date: '2099-05-20T00:00:00.000Z', capacity: 4, remaining: 4 }],
  },
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.params }));
vi.mock('../api', () => ({
  useListCustomToursQuery: () => mocks.list,
  useSaveCustomTourDraftMutation: () => [mocks.save, { isLoading: false }],
  useSendCustomTourOfferMutation: () => [mocks.sendOffer, { isLoading: false }],
  useAcceptCustomTourOfferMutation: () => [mocks.accept, { isLoading: false }],
  useDecideCustomTourMutation: () => [mocks.decide, { isLoading: false }],
}));
vi.mock('@/features/tours/api/toursApi', () => ({
  useGetAgencyTourQuery: () => ({ data: mocks.tour, isLoading: false, isError: false, refetch: mocks.tourRefetch }),
  useGetTourCategoriesQuery: () => ({ data: [{ id: 'cat1', name: 'Biển' }], isLoading: false }),
}));
vi.mock('@/features/tours/components/TourContentFields', () => ({
  TourContentFields: ({ value, onChange }: { value: { title: string }; onChange: (next: never) => void }) => (
    <div>
      <p>Tiêu đề: {value.title}</p>
      <button type="button" onClick={() => onChange({ ...value, title: 'Tour đoàn đã sửa' } as never)}>Sửa tiêu đề</button>
    </div>
  ),
}));
vi.mock('@/features/tours/components/detail/TourGuestSelector', () => ({
  TourGuestSelector: ({ value, onChange }: { value: { adults: number; children: number; infants: number }; onChange: (next: never) => void }) => (
    <button type="button" onClick={() => onChange({ ...value, adults: value.adults - 1, children: value.children + 1 } as never)}>
      Chuyển khách lớn thành trẻ em
    </button>
  ),
}));

import { CustomTourChatSection } from '../components/CustomTourChatSection';

const offer = {
  revision: 3,
  unitPrice: 1_500_000,
  agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
  guestCounts: { adults: 2, children: 2, infants: 0 },
  subtotal: 4_500_000,
  departureDate: '2099-05-20T00:00:00.000Z',
  sentAt: '2026-11-01T03:00:00.000Z',
  content: {
    title: 'Tour đoàn Đà Nẵng 3N2Đ',
    destination: 'Đà Nẵng',
    durationDays: 3,
    summary: 'Ba ngày riêng cho đoàn, khởi hành theo ngày đã chọn.',
    description: 'Ngày 1: đón đoàn tại sân bay Đà Nẵng và nhận phòng.',
    inclusions: ['Xe đưa đón riêng', 'Khách sạn 4 sao'],
    exclusions: ['Chi phí cá nhân'],
    cancellationPolicy: 'Hủy trước 7 ngày hoàn 100%.',
  },
};

const request = (
  overrides: Partial<CustomTourRequestDto> & Pick<CustomTourRequestDto, 'id' | 'status' | 'nextStep'>,
): CustomTourRequestDto => ({
  revision: 3,
  participants: 4,
  checkoutRevision: 1,
  guestCounts: { adults: 4, children: 0, infants: 0 },
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
  ...overrides,
});

const negotiable = (overrides: Partial<CustomTourRequestDto> = {}) =>
  request({ id: 'r1', status: 'NEGOTIATING', nextStep: 'NEGOTIATING', ...overrides });

const open = () => fireEvent.click(screen.getByRole('button', { name: /Xem thỏa thuận/ }));

beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.save.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  mocks.sendOffer.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  mocks.accept.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  mocks.decide.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CustomTourChatSection', () => {
  it('renders nothing for a conversation without a group request', () => {
    mocks.list.data = { items: [] };
    const { container } = render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens the dialog from the pinned card, and closing it returns focus to the card', () => {
    mocks.list.data = { items: [request({ id: 'r1', status: 'OFFERED', nextStep: 'REVIEW_OFFER', offer })] };
    render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    const pin = screen.getByRole('button', { name: /Xem thỏa thuận/ });
    expect(screen.getByText('Đã gửi thỏa thuận')).toBeTruthy();
    expect(screen.getByText(/4 người · 4 người lớn · 20\/05\/2099/)).toBeTruthy();

    fireEvent.click(pin);
    const panel = screen.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Đóng thỏa thuận' }));
    expect(screen.queryByRole('dialog', { name: 'Thỏa thuận booking đoàn' })).toBeNull();
    expect(document.activeElement).toBe(pin);

    // Closing keeps the selected request, so reopening lands on the same terms.
    fireEvent.click(pin);
    expect(within(screen.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' })).getAllByText('Đã gửi thỏa thuận').length).toBeGreaterThan(0);
  });

  it('lets a conversation with several requests pick which one the card shows', () => {
    mocks.list.data = {
      items: [
        negotiable(),
        request({ id: 'r2', status: 'OFFERED', nextStep: 'REVIEW_OFFER', offer, participants: 2, guestCounts: { adults: 2, children: 0, infants: 0 } }),
      ],
    };
    render(<CustomTourChatSection conversationId="c1" isAgency />);
    const select = screen.getByLabelText('Chọn yêu cầu đoàn');
    fireEvent.change(select, { target: { value: 'r2' } });
    expect(screen.getByText('Đã gửi thỏa thuận')).toBeTruthy();
    open();
    const panel = screen.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' });
    expect(within(panel).getByText(/Đã gửi thỏa thuận, khách đang xem/)).toBeTruthy();
  });

  it('saves the draft with the request revision and never sends the fixed head count', async () => {
    mocks.list.data = { items: [negotiable()] };
    render(<CustomTourChatSection conversationId="c1" isAgency />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển khách lớn thành trẻ em' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const payload = mocks.save.mock.calls[0][0];
    expect(payload).toMatchObject({ id: 'r1', revision: 3, guestCounts: { adults: 3, children: 1, infants: 0 } });
    expect(payload.departure.date).toBe(new Date('2099-05-20').toISOString());
    expect(payload.content).not.toHaveProperty('maxGroupSize');
    expect(payload.content.title).toBe('Tour đoàn Đà Nẵng 3N2Đ');
    expect(await screen.findByText('Đã lưu')).toBeTruthy();
  });

  it('keeps the typed terms when the request was changed elsewhere, and reloads it', async () => {
    mocks.save.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { code: 'CONCURRENT_UPDATE' } } }) });
    mocks.list.data = { items: [negotiable()] };
    render(<CustomTourChatSection conversationId="c1" isAgency />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa tiêu đề' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));

    expect(await screen.findByText(/Bản đã được thay đổi ở nơi khác/)).toBeTruthy();
    expect(mocks.list.refetch).toHaveBeenCalled();
    expect(screen.getByText('Tiêu đề: Tour đoàn đã sửa')).toBeTruthy();
  });

  it('sends the offer only for saved terms, with the current revision', async () => {
    mocks.list.data = { items: [negotiable()] };
    render(<CustomTourChatSection conversationId="c1" isAgency />);
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Sửa tiêu đề' }));
    expect((screen.getByRole('button', { name: 'Gửi thỏa thuận' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Lưu nháp trước khi gửi thỏa thuận.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await screen.findByText('Đã lưu');
    expect((screen.getByRole('button', { name: 'Gửi thỏa thuận' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Gửi thỏa thuận' }));
    await waitFor(() => expect(mocks.sendOffer).toHaveBeenCalledWith({ id: 'r1', revision: 3 }));
  });

  it('lets the agency accept a fresh request before editing it', async () => {
    mocks.list.data = { items: [request({ id: 'r1', status: 'SUBMITTED', nextStep: 'WAITING_AGENCY' })] };
    render(<CustomTourChatSection conversationId="c1" isAgency />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Nhận tư vấn' }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith({ id: 'r1', decision: 'ACCEPT' }));
  });
});

describe('TravelerOfferReview', () => {
  it('shows the tour details the agency sent, next to the per-group prices', () => {
    mocks.list.data = { items: [request({ id: 'r1', status: 'OFFERED', nextStep: 'REVIEW_OFFER', offer, guestCounts: offer.guestCounts })] };
    render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    open();

    const details = screen.getByRole('region', { name: 'Thông tin tour' });
    expect(within(details).getByText('Đà Nẵng · 3 ngày')).toBeTruthy();
    expect(within(details).getByText('Ngày 1: đón đoàn tại sân bay Đà Nẵng và nhận phòng.')).toBeTruthy();
    expect(within(details).getByText('Xe đưa đón riêng')).toBeTruthy();
    expect(within(details).getByText('Chi phí cá nhân')).toBeTruthy();
    expect(within(details).getByText('Hủy trước 7 ngày hoàn 100%.')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('shows the per-group prices and accepts the exact revision the traveler reviewed', async () => {
    mocks.list.data = { items: [request({ id: 'r1', status: 'OFFERED', nextStep: 'REVIEW_OFFER', offer, guestCounts: offer.guestCounts })] };
    render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    open();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Người lớn × 2')).toBeTruthy();
    expect(within(table).getByText('Trẻ em × 2')).toBeTruthy();
    expect(within(table).getByText('4.500.000 ₫')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận thỏa thuận' }));
    const confirm = screen.getByRole('group', { name: 'Xác nhận thỏa thuận' });
    expect(within(confirm).getByText(/Ngày khởi hành: 20\/05\/2099/)).toBeTruthy();
    expect(within(confirm).getByText(/Tổng tiền: 4.500.000 ₫/)).toBeTruthy();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Xác nhận chấp nhận' }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith({ id: 'r1', revision: 3 }));
  });

  it('points an accepted group at the passenger form', () => {
    mocks.list.data = { items: [request({ id: 'r1', status: 'ACCEPTED', nextStep: 'ENTER_PASSENGERS', offer })] };
    render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    open();
    expect(screen.getByText('Bạn đã chấp nhận thỏa thuận.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nhập hành khách' }).getAttribute('href')).toBe('/traveler/bookings/new?customTourRequestId=r1');
  });

  it('points an accepted group with a booking at that booking', () => {
    mocks.list.data = {
      items: [request({
        id: 'r1',
        status: 'ACCEPTED',
        nextStep: 'PAY',
        offer,
        currentBooking: { id: 'b1', status: 'PENDING', bookingCode: 'TRP-ABCD2345', isPaid: false },
      })],
    };
    render(<CustomTourChatSection conversationId="c1" isAgency={false} />);
    open();
    expect(screen.getByRole('link', { name: 'Xem đơn' }).getAttribute('href')).toBe('/settings/history/b1');
  });
});
