import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTourListResult, CustomTourRequestDto } from '../types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  decide: vi.fn(),
  push: vi.fn(),
  list: { data: undefined as CustomTourListResult | undefined },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('../api', () => ({
  useCreateCustomTourMutation: () => [mocks.create, { isLoading: false }],
  useDecideCustomTourMutation: () => [mocks.decide, { isLoading: false }],
  useListCustomToursQuery: () => ({ data: mocks.list.data, isLoading: false, isError: false, refetch: vi.fn() }),
  useGetCustomTourQuery: () => ({ data: undefined }),
}));

import { GroupBookingRequestDialog } from '../components/GroupBookingRequestDialog';
import { MyCustomToursPage } from '../components/MyCustomToursPage';
import { AgencyCustomToursPage } from '../components/AgencyCustomToursPage';
import { customTourChatHref, customTourHref, notificationHref } from '../links';

const request = (
  overrides: Partial<CustomTourRequestDto> & Pick<CustomTourRequestDto, 'id' | 'status' | 'nextStep'>,
): CustomTourRequestDto => ({
  revision: 1,
  participants: 4,
  checkoutRevision: 1,
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  mocks.create.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'r9', conversationId: 'c9' }) });
  mocks.decide.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  mocks.list.data = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GroupBookingRequestDialog', () => {
  it('tính tổng theo đúng nhóm tuổi của tour và chặn đoàn dưới 2 người', () => {
    render(
      <GroupBookingRequestDialog
        tourId="t1"
        open
        onClose={vi.fn()}
        defaultGuests={{ adults: 1, children: 0, infants: 0 }}
        unitPrice={1000000}
        pricing={{ childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 }}
      />,
    );
    const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    // One adult is the tour page default and is below the group floor.
    submit();
    expect(screen.getByText('Đoàn phải từ 2 đến 50 người.')).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Tăng người lớn' }));
    expect(screen.queryByText('Đoàn phải từ 2 đến 50 người.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tăng người lớn' }));
    // The tour prices children, so its own child row is offered here.
    fireEvent.click(screen.getByRole('button', { name: 'Tăng trẻ em' }));
    expect(screen.getByText(/Tổng 4 người/)).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: /Ghi chú/ }), { target: { value: 'x'.repeat(501) } });
    submit();
    expect(screen.getByText(/Ghi chú tối đa 500 ký tự/)).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('chặn ngày khởi hành đã qua và gửi ngày dự kiến đã chọn', async () => {
    render(
      <GroupBookingRequestDialog
        tourId="t1"
        open
        onClose={vi.fn()}
        defaultGuests={{ adults: 2, children: 0, infants: 0 }}
        defaultStartDate="2020-01-01"
        unitPrice={1000000}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(screen.getByText('Ngày khởi hành phải ở tương lai.')).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Ngày khởi hành dự kiến'), { target: { value: '2027-03-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: new Date('2027-03-15').toISOString() }),
      ),
    );
  });

  it('gửi yêu cầu thành công kèm cơ cấu tuổi và chuyển tới hội thoại', async () => {
    const onClose = vi.fn();
    const defaultGuests = { adults: 3, children: 2, infants: 1 };
    render(<GroupBookingRequestDialog tourId="t1" open onClose={onClose} defaultGuests={defaultGuests} unitPrice={1000000} />);

    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/conversations/c9?request=r9'));
    expect(mocks.create).toHaveBeenCalledWith({
      sourceTourId: 't1',
      participants: 6,
      guestCounts: defaultGuests,
      notes: undefined,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('giữ nguyên dữ liệu đã nhập khi máy chủ báo lỗi', async () => {
    mocks.create.mockReturnValue({
      unwrap: () => Promise.reject({ data: { error: { message: 'Tour đã đóng nhận yêu cầu' } } }),
    });
    render(
      <GroupBookingRequestDialog tourId="t1" open onClose={vi.fn()} defaultGuests={{ adults: 2, children: 0, infants: 0 }} unitPrice={1000000} />,
    );

    const adults = screen.getByRole('spinbutton', { name: 'Người lớn' });
    fireEvent.click(screen.getByRole('button', { name: 'Tăng người lớn' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Ghi chú/ }), { target: { value: 'Đi cuối tuần' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Tour đã đóng nhận yêu cầu');
    expect((adults as HTMLInputElement).value).toBe('3');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe('MyCustomToursPage', () => {
  it('hiển thị trạng thái, tổng thỏa thuận và đúng đường dẫn tiếp tục', () => {
    mocks.list.data = {
      items: [
        request({
          id: 'r1',
          status: 'NEGOTIATING',
          nextStep: 'NEGOTIATING',
          conversationId: 'c1',
          sourceTour: { id: 't1', title: 'Tour Hạ Long', images: [] },
          guestCounts: { adults: 2, children: 1, infants: 1 },
          startDate: '2026-12-20T00:00:00.000Z',
          notes: 'Cần xe đưa đón',
        }),
        request({
          id: 'r2',
          status: 'ACCEPTED',
          nextStep: 'ENTER_PASSENGERS',
          sourceTour: { id: 't2', title: 'Tour Đà Nẵng', images: [] },
        }),
        request({
          id: 'r3',
          status: 'OFFERED',
          nextStep: 'REVIEW_OFFER',
          conversationId: 'c3',
          sourceTour: { id: 't3', title: 'Tour Sapa', images: [] },
          offer: {
            revision: 2,
            unitPrice: 1000000,
            guestCounts: { adults: 4, children: 0, infants: 0 },
            subtotal: 5000000,
            departureDate: '2027-01-01',
            sentAt: '2026-11-02T00:00:00.000Z',
          },
        }),
        request({
          id: 'r4',
          status: 'DECLINED',
          nextStep: 'CLOSED',
          sourceTour: { id: 't4', title: 'Tour Huế', images: [] },
        }),
      ],
      meta: { page: 1, limit: 10, total: 4, totalPages: 1 },
    };

    render(<MyCustomToursPage />);

    expect(screen.getByText('Yêu cầu đoàn của tôi')).toBeTruthy();
    expect(screen.getByText('Đang thương lượng')).toBeTruthy();
    expect(screen.getByText('Đại lý từ chối')).toBeTruthy();

    const negotiating = screen.getByText('Tour Hạ Long').closest('li')!;
    expect(within(negotiating).getByText('4 người · 2 người lớn, 1 trẻ em, 1 em bé')).toBeTruthy();
    expect(within(negotiating).getByText(/Khởi hành dự kiến 20\/12\/2026/)).toBeTruthy();
    expect(within(negotiating).getByRole('link', { name: 'Mở chat' }).getAttribute('href')).toBe(
      '/conversations/c1?request=r1',
    );

    const accepted = screen.getByText('Tour Đà Nẵng').closest('li')!;
    expect(within(accepted).getByRole('link', { name: 'Nhập hành khách' }).getAttribute('href')).toBe(
      '/traveler/bookings/new?customTourRequestId=r2',
    );

    const offered = screen.getByText('Tour Sapa').closest('li')!;
    expect(within(offered).getByText('Tổng tạm tính: 5.000.000 ₫')).toBeTruthy();

    const closed = screen.getByText('Tour Huế').closest('li')!;
    expect(within(closed).queryByRole('link')).toBeNull();
  });
});

describe('AgencyCustomToursPage', () => {
  it('nhận rồi từ chối yêu cầu đang chờ', async () => {
    mocks.list.data = {
      items: [
        request({
          id: 'r5',
          status: 'SUBMITTED',
          nextStep: 'WAITING_AGENCY',
          participants: 6,
          sourceTour: { id: 't5', title: 'Tour Ninh Bình', images: [] },
        }),
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };

    render(<AgencyCustomToursPage />);
    expect(screen.getByText('Yêu cầu đoàn')).toBeTruthy();
    expect(screen.getByText('Chờ đại lý phản hồi')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Nhận' }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith({ id: 'r5', decision: 'ACCEPT' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Từ chối' }).hasAttribute('disabled')).toBe(false),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    await waitFor(() => expect(mocks.decide).toHaveBeenLastCalledWith({ id: 'r5', decision: 'DECLINE' }));
  });
});

describe('links', () => {
  it('tính đúng bước tiếp theo của yêu cầu đoàn', () => {
    expect(customTourHref({ id: 'r1', nextStep: 'NEGOTIATING', conversationId: 'c1' }, 'TRAVELER')).toBe(
      '/conversations/c1?request=r1',
    );
    expect(customTourHref({ id: 'r1', nextStep: 'WAITING_AGENCY' }, 'AGENCY')).toBe('/agency/custom-tours');
    expect(customTourHref({ id: 'r1', nextStep: 'WAITING_AGENCY' }, 'TRAVELER')).toBe('/traveler/custom-tours');
    expect(customTourHref({ id: 'r1', nextStep: 'ENTER_PASSENGERS' }, 'TRAVELER')).toBe(
      '/traveler/bookings/new?customTourRequestId=r1',
    );
    expect(customTourHref({ id: 'r1', nextStep: 'PAY' }, 'TRAVELER')).toBeNull();
    expect(
      customTourHref(
        { id: 'r1', nextStep: 'DONE', currentBooking: { id: 'b1', status: 'CONFIRMED', bookingCode: 'BK1', isPaid: true } },
        'TRAVELER',
      ),
    ).toBe('/settings/history/b1');
    expect(customTourHref({ id: 'r1', nextStep: 'CLOSED' }, 'TRAVELER')).toBeNull();
    expect(customTourChatHref({ id: 'r1', conversationId: 'c1' }, 'TRAVELER')).toBe('/conversations/c1?request=r1');
    expect(customTourChatHref({ id: 'r1' }, 'AGENCY')).toBe('/agency/custom-tours');
  });

  it('mở đúng hội thoại từ thông báo và giữ fallback cho loại khác', () => {
    expect(
      notificationHref({ type: 'CUSTOM_TOUR_OFFERED', data: { conversationId: 'c1', requestId: 'r1' } }, 'TRAVELER'),
    ).toBe('/conversations/c1?request=r1');
    expect(notificationHref({ type: 'CUSTOM_TOUR_SUBMITTED' }, 'AGENCY')).toBe('/agency/custom-tours');
    expect(notificationHref({ type: 'CUSTOM_TOUR_SUBMITTED' }, 'TRAVELER')).toBe('/traveler/custom-tours');
    expect(notificationHref({ type: 'BOOKING_CONFIRMED' }, 'TRAVELER')).toBeUndefined();
  });
});
