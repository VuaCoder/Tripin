import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTourCheckoutDraft, CustomTourRequestDto } from '../types';

const mocks = vi.hoisted(() => ({
  query: { data: undefined as CustomTourRequestDto | undefined, isLoading: false, isError: false, refetch: vi.fn() },
  save: vi.fn(),
  book: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('../api', () => ({
  useGetCustomTourQuery: () => mocks.query,
  useSaveCustomTourCheckoutDraftMutation: () => [mocks.save, { isLoading: false }],
  useCreateCustomTourBookingMutation: () => [mocks.book, { isLoading: false }],
}));

import { GroupBookingEntry } from '../components/GroupBookingEntry';

const offer: NonNullable<CustomTourRequestDto['offer']> = {
  revision: 2,
  unitPrice: 1_500_000,
  agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
  guestCounts: { adults: 2, children: 1, infants: 0 },
  subtotal: 3_750_000,
  departureDate: '2099-05-20T00:00:00.000Z',
  sentAt: '2026-11-01T03:00:00.000Z',
  content: { title: 'Tour đoàn Đà Nẵng 3N2Đ', destination: 'Đà Nẵng', durationDays: 3, inclusions: [], exclusions: [] },
};

const request = (overrides: Partial<CustomTourRequestDto> = {}): CustomTourRequestDto => ({
  id: 'ct1',
  status: 'ACCEPTED',
  revision: 2,
  participants: 3,
  guestCounts: { adults: 2, children: 1, infants: 0 },
  offer,
  checkoutRevision: 1,
  nextStep: 'ENTER_PASSENGERS',
  conversationId: 'conv1',
  createdAt: '2026-11-01T03:00:00.000Z',
  updatedAt: '2026-11-01T03:00:00.000Z',
  ...overrides,
});

const member = (index: number, guestType: 'ADULT' | 'CHILD' = 'ADULT') => ({
  fullName: `Khách ${index}`,
  phone: '0912345678',
  idCard: String(index).padStart(12, '0'),
  guestType,
});

const idCard = (index: number) => String(index).padStart(12, '0');

/** Fills the contact block and every passenger row with valid values. */
function fillForm({ partial = false } = {}) {
  fireEvent.change(document.querySelector('#contact-fullName')!, { target: { value: 'Nguyễn Văn A' } });
  if (partial) return;
  fireEvent.change(document.querySelector('#contact-phone')!, { target: { value: '0912345678' } });
  for (let index = 0; index < 3; index += 1) {
    fireEvent.change(document.querySelector(`#passenger-${index}-fullName`)!, { target: { value: `Khách ${index + 1}` } });
    fireEvent.change(document.querySelector(`#passenger-${index}-phone`)!, { target: { value: '0912345678' } });
    fireEvent.change(document.querySelector(`#passenger-${index}-idCard`)!, { target: { value: idCard(index + 1) } });
  }
}

describe('GroupBookingEntry', () => {
  beforeEach(() => {
    mocks.query = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
    mocks.save.mockReset();
    mocks.book.mockReset();
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.book.mockReturnValue({ unwrap: async () => ({ id: 'b1', bookingCode: 'TRP-ABCD2345' }) });
    // The server echoes what it stored and bumps the form's own revision.
    mocks.save.mockImplementation(({ checkoutRevision, ...draft }: CustomTourCheckoutDraft & { id: string; checkoutRevision: number }) => ({
      unwrap: async () => ({ ...request(), checkoutRevision: checkoutRevision + 1, checkoutDraft: draft }),
    }));
  });
  afterEach(cleanup);

  it('renders one row per member of the accepted group, with the frozen price', async () => {
    mocks.query.data = request();
    render(<GroupBookingEntry requestId="ct1" />);

    expect(await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' })).toBeTruthy();
    expect(screen.getByText('Người lớn 1')).toBeTruthy();
    expect(screen.getByText('Người lớn 2')).toBeTruthy();
    expect(screen.getByText('Trẻ em 1')).toBeTruthy();
    expect(screen.getAllByLabelText('Họ và tên')).toHaveLength(4);
    expect(screen.getByText(/3\.750\.000/)).toBeTruthy();
    // Nothing typed yet, so nothing to save.
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('autosaves a complete form with its checkout revision and reports the save', async () => {
    mocks.query.data = request();
    render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    fillForm();

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mocks.save.mock.calls[0]![0]).toMatchObject({
      id: 'ct1',
      checkoutRevision: 1,
      contact: { fullName: 'Nguyễn Văn A', phone: '0912345678' },
      passengers: [
        { guestType: 'ADULT', fullName: 'Khách 1', idCard: idCard(1) },
        { guestType: 'ADULT', fullName: 'Khách 2', idCard: idCard(2) },
        { guestType: 'CHILD', fullName: 'Khách 3', idCard: idCard(3) },
      ],
    });
    expect(await screen.findByText(/Đã lưu lúc/)).toBeTruthy();
  });

  it('restores the saved form and leaves it alone until something changes', async () => {
    mocks.query.data = request({
      checkoutRevision: 3,
      checkoutDraft: { contact: { fullName: 'Trần Thị B', phone: '0987654321' }, passengers: [member(1), member(2), member(3, 'CHILD')], notes: 'Cần phòng tầng thấp' },
    });
    render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    expect((document.querySelector('#contact-fullName') as HTMLInputElement).value).toBe('Trần Thị B');
    expect((document.querySelector('#passenger-2-idCard') as HTMLInputElement).value).toBe(idCard(3));
    expect((document.querySelector('#group-notes-input') as HTMLTextAreaElement).value).toBe('Cần phòng tầng thấp');
    expect(screen.getByText(/Thông tin đã được lưu/)).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('never saves a half-typed form, but warns before the page is left', async () => {
    mocks.query.data = request();
    render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    fillForm({ partial: true });
    expect(screen.getByText(/Chưa lưu — còn thiếu/)).toBeTruthy();

    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('shows a concurrent save and retries with the revision that won', async () => {
    mocks.query.data = request();
    mocks.save.mockImplementationOnce(() => ({
      unwrap: () => Promise.reject({ status: 409, data: { error: { code: 'CONCURRENT_UPDATE', message: 'changed' } } }),
    }));
    const { rerender } = render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    fillForm();
    expect((await screen.findByRole('alert')).textContent).toContain('thiết bị khác');
    expect(mocks.query.refetch).toHaveBeenCalled();

    mocks.query.data = request({ checkoutRevision: 2 });
    rerender(<GroupBookingEntry requestId="ct1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(mocks.save.mock.calls[1]![0]).toMatchObject({ checkoutRevision: 2 });
    expect(await screen.findByText(/Đã lưu lúc/)).toBeTruthy();
  });

  it('saves the form once more, then books and opens the booking', async () => {
    mocks.query.data = request();
    render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt chỗ và thanh toán' }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/settings/history/b1'));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.book).toHaveBeenCalledWith({ id: 'ct1' });
  });

  it('shows the booking instead of the form once the request already has one', async () => {
    mocks.query.data = request({ nextStep: 'PAY', currentBooking: { id: 'b1', status: 'PENDING', bookingCode: 'TRP-ABCD2345', isPaid: false } });
    render(<GroupBookingEntry requestId="ct1" />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/settings/history/b1'));
    expect(screen.queryByRole('heading', { name: 'Nhập thông tin hành khách' })).toBeNull();
  });

  it('sends a request that is not at the passenger step back to its next step', async () => {
    mocks.query.data = request({ status: 'NEGOTIATING', nextStep: 'NEGOTIATING', offer: undefined });
    render(<GroupBookingEntry requestId="ct1" />);

    expect(await screen.findByText('Chưa tới bước nhập hành khách')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Về yêu cầu' }));
    expect(mocks.push).toHaveBeenCalledWith('/conversations/conv1?request=ct1');
  });

  it('does not open the form for an offer whose departure already passed', async () => {
    mocks.query.data = request({ offer: { ...offer, departureDate: '2020-01-01T00:00:00.000Z' } });
    render(<GroupBookingEntry requestId="ct1" />);

    expect(await screen.findByText('Ngày khởi hành đã qua')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Đặt chỗ và thanh toán' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trao đổi với đại lý' }));
    expect(mocks.push).toHaveBeenCalledWith('/conversations/conv1?request=ct1');
  });

  it('explains a stale departure from the server and links back to the agency', async () => {
    mocks.query.data = request();
    mocks.book.mockReturnValueOnce({
      unwrap: () => Promise.reject({ status: 409, data: { error: { code: 'DEPARTURE_PASSED', message: 'The departure of this offer has already passed' } } }),
    });
    render(<GroupBookingEntry requestId="ct1" />);
    await screen.findByRole('heading', { name: 'Nhập thông tin hành khách' });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt chỗ và thanh toán' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Ngày khởi hành của thỏa thuận đã qua.');
    expect(alert.querySelector('a')!.getAttribute('href')).toBe('/conversations/conv1?request=ct1');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
