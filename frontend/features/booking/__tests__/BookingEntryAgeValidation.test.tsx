import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BookingEntryPage } from '../components/BookingEntryPage';

vi.mock('@/features/premium/api', () => ({
  usePremiumVouchersQuery: () => ({ currentData: [], refetch: vi.fn() }),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockCreateBooking = vi.fn();
const mockQuoteBooking = vi.fn();
const mockCheckoutBooking = vi.fn();
const mockRefetchTour = vi.fn();

vi.mock('@/features/payment/api/paymentApi', () => ({
  useCheckoutBookingMutation: () => [mockCheckoutBooking, { isLoading: false }],
}));

// Step 2, 1 adult, 1 child -> 2 participants
let mockParams = new URLSearchParams('tourId=tour-1&departureId=dep-1&participants=2&adults=1&children=1&infants=0&step=2');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockParams,
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({ id: 'u1', fullName: 'Nguyen Van A', phone: '0912345678' }),
  useAppDispatch: () => vi.fn(),
}));

const mockTour = {
  id: 'tour-1',
  agencyId: 'agency-123',
  title: 'Hành trình di sản miền Trung',
  agePricing: {
    childMinAge: 2,
    adultMinAge: 13,
    childPercent: 50,
    infantPercent: 0,
  },
  departures: [
    {
      id: 'dep-1',
      date: new Date(Date.now() + 86400000 * 10).toISOString(),
      price: 1000000,
      isOpen: true,
      remaining: 10,
    },
  ],
};

vi.mock('@/features/tours', () => ({
  useGetTourQuery: () => ({ data: mockTour, isLoading: false, isError: false, refetch: mockRefetchTour }),
}));

vi.mock('../api/bookingApi', () => ({
  useGetAvailablePromotionsQuery: () => ({ data: { platform: [], agency: [] } }),
  useGetMyVouchersQuery: () => ({ data: [] }),
  useCreateBookingMutation: () => [mockCreateBooking, { isLoading: false }],
  useQuoteBookingMutation: () => [mockQuoteBooking, { isLoading: false }],
  useLazyPreviewPromotionQuery: () => [vi.fn(), { isFetching: false }],
}));

describe('BookingEntryPage Age Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = new URLSearchParams('tourId=tour-1&departureId=dep-1&participants=2&adults=1&children=1&infants=0&step=2');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows age range guide for Child passenger and validates birth year', async () => {
    render(<BookingEntryPage />);

    // Passenger 1 is Adult, Passenger 2 is Child
    expect(screen.getByText('Hành khách 1')).toBeDefined();
    expect(screen.getByText('Người lớn')).toBeDefined();
    expect(screen.getByText('Hành khách 2')).toBeDefined();
    expect(screen.getByText('Trẻ em')).toBeDefined();

    // Age hint is shown on Child input label
    expect(screen.getByText('(Độ tuổi 2 – 12)')).toBeDefined();

    // Passenger 2 (Child) card
    const passenger2Card = screen.getByText('Hành khách 2').closest('.rounded-xl')!;
    const birthYearInput = passenger2Card.querySelector('input[maxlength="4"]') as HTMLInputElement;
    expect(birthYearInput).toBeDefined();

    // Enter birthYear 2000 for Child (age ~26 in 2026 -> out of range!)
    fireEvent.change(birthYearInput, { target: { value: '2000' } });

    // Warning message appears with option to change ticket
    await waitFor(() => {
      expect(screen.getByText(/Vé Trẻ em áp dụng từ 2 – 12 tuổi/)).toBeDefined();
      expect(screen.getByText(/đổi sang vé Người lớn/)).toBeDefined();
      expect(screen.getByText('Quay lại Bước 1 để đổi vé')).toBeDefined();
    });

    // If user changes to valid year (e.g. 2018 -> 8 years old), error disappears
    fireEvent.change(birthYearInput, { target: { value: '2018' } });

    await waitFor(() => {
      expect(screen.queryByText(/Vé Trẻ em áp dụng từ 2 – 12 tuổi/)).toBeNull();
    });
  });

  it('blocks step progression to Step 3 and triggers AlertModal when child age is invalid', async () => {
    render(<BookingEntryPage />);

    // Fill contact name & passenger names
    const nameInputs = screen.getAllByPlaceholderText('VD: Nguyễn Văn A');
    fireEvent.change(nameInputs[0], { target: { value: 'Nguyễn Văn A' } }); // Contact
    fireEvent.change(nameInputs[1], { target: { value: 'Nguyễn Văn A' } }); // Passenger 1
    fireEvent.change(nameInputs[2], { target: { value: 'Bánh Bò' } }); // Passenger 2

    // Fill child birth year 2000 in passenger 2
    const passenger2Card = screen.getByText('Hành khách 2').closest('.rounded-xl')!;
    const birthYearInput = passenger2Card.querySelector('input[maxlength="4"]') as HTMLInputElement;
    fireEvent.change(birthYearInput, { target: { value: '2000' } });

    // Click next button "Tiếp tục: Thanh toán >"
    const nextBtn = screen.getByText(/Tiếp tục: Thanh toán/i);
    fireEvent.click(nextBtn);

    // Modal popup appears
    await waitFor(() => {
      expect(screen.getByText('Thông báo')).toBeDefined();
      expect(screen.getByText(/Hành khách 2 \(Trẻ em\):/)).toBeDefined();
      expect(screen.getAllByText(/Quay lại Bước 1 để đổi vé/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
