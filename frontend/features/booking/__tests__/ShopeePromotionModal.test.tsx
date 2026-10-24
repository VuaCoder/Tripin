import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ShopeePromotionModal } from '../components/ShopeePromotionModal';

describe('ShopeePromotionModal', () => {
  afterEach(() => {
    cleanup();
  });
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    subtotal: 1000000,
    agencyPromotionCode: '',
    agencyPromotionPreview: null,
    agencyPromotionError: null,
    onApplyAgencyCode: vi.fn(),
    onClearAgencyCode: vi.fn(),
    platformPromotionCode: '',
    platformPromotionPreview: null,
    platformPromotionError: null,
    onApplyPlatformCode: vi.fn(),
    onClearPlatformCode: vi.fn(),
    onApplyDirectCode: vi.fn(),
    availablePromos: {
      agency: [
        {
          id: 'p-tour-agency',
          code: 'TOUR10',
          title: 'Giảm 10% cho tour',
          discountType: 'PERCENT' as const,
          discountValue: 10,
          minOrderAmount: 500000,
          startsAt: new Date(Date.now() - 1000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
          scope: 'AGENCY' as const,
          isActive: true,
          agencyId: 'agency-1',
          usedCount: 0,
          isRunning: true,
        },
      ],
      platform: [
        {
          id: 'p-tour-plat',
          code: 'PLATFORM20',
          title: 'Giảm 20k toàn sàn',
          discountType: 'FIXED' as const,
          discountValue: 20000,
          minOrderAmount: 2000000, // higher than subtotal 1,000,000 -> should be ineligible
          startsAt: new Date(Date.now() - 1000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(),
          scope: 'PLATFORM' as const,
          isActive: true,
          usedCount: 0,
          isRunning: true,
        },
      ],
    },
    myAgencyVouchers: [],
    myPlatformVouchers: [],
    isPreviewing: false,
  };

  it('transforms space to underscore in search input', () => {
    render(<ShopeePromotionModal {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Nhập mã voucher/i);
    fireEvent.change(searchInput, { target: { value: 'SUMMER 2026' } });

    expect((searchInput as HTMLInputElement).value).toBe('SUMMER_2026');
  });

  it('filters vouchers according to search query', () => {
    render(<ShopeePromotionModal {...defaultProps} />);

    expect(screen.getByText('TOUR10')).toBeDefined();
    expect(screen.getByText('PLATFORM20')).toBeDefined();

    const searchInput = screen.getByPlaceholderText(/Nhập mã voucher/i);
    fireEvent.change(searchInput, { target: { value: 'TOUR' } });

    expect(screen.getByText('TOUR10')).toBeDefined();
    expect(screen.queryByText('PLATFORM20')).toBeNull();
  });

  it('shows ineligibility message if subtotal does not meet minOrderAmount', () => {
    render(<ShopeePromotionModal {...defaultProps} />);

    // PLATFORM20 requires 2,000,000 but subtotal is 1,000,000
    expect(screen.getByText(/Cần thêm 1.000.000 ₫ để dùng mã này/i)).toBeDefined();
  });

  it('calls onApplyDirectCode when clicking Áp dụng in header', async () => {
    const mockDirect = vi.fn().mockResolvedValue({ success: true, message: 'Thành công' });
    render(<ShopeePromotionModal {...defaultProps} onApplyDirectCode={mockDirect} />);

    const searchInput = screen.getByPlaceholderText(/Nhập mã voucher/i);
    fireEvent.change(searchInput, { target: { value: 'TEST_CODE' } });

    const applyBtn = screen.getByRole('button', { name: 'Áp dụng' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockDirect).toHaveBeenCalledWith('TEST_CODE');
    });
  });
});
