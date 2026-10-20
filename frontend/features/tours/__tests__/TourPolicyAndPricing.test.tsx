import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { TourAgePricingFields } from '../components/TourAgePricingFields';
import { TourPolicyFields } from '../components/TourPolicyFields';
import type { TourContentInput } from '../types';

afterEach(cleanup);

const baseTour: TourContentInput = {
  title: 'Hành trình di sản miền Trung',
  destination: 'Đà Nẵng',
  durationDays: 3,
  basePrice: 2000000,
  categoryIds: ['cat-1'],
  agePricing: { childMinAge: 2, adultMinAge: 12, childPercent: 50, infantPercent: 0 },
  childPricingPolicy: '',
  cancellationPolicy: '',
  requiredDocuments: '',
  travelNotes: '',
};

describe('TourAgePricingFields', () => {
  it('displays live calculated prices based on base price', () => {
    const onChange = vi.fn();
    render(<TourAgePricingFields value={baseTour} onChange={onChange} />);

    // Should display adult price (2,000,000 VND)
    expect(screen.getByText(/2.000.000/i)).toBeDefined();
    // Should display child price 50% = 1,000,000 VND
    expect(screen.getByText(/1.000.000/i)).toBeDefined();
    // Should display infant price = Miễn phí
    expect(screen.getAllByText(/Miễn phí/i).length).toBeGreaterThan(0);
  });

  it('appends child policy preset when clicked', () => {
    const onChange = vi.fn();
    render(<TourAgePricingFields value={baseTour} onChange={onChange} />);

    const chip = screen.getByRole('button', { name: /\+ 👶 Dưới 2 tuổi: Miễn phí/i });
    fireEvent.click(chip);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        childPricingPolicy: expect.stringContaining('Dưới 2 tuổi: Miễn phí'),
      })
    );
  });
});

describe('TourPolicyFields', () => {
  it('applies quick template and generates standard cancellation terms', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Click on "Linh hoạt" template button
    const flexibleBtn = screen.getByRole('button', { name: /Hủy miễn phí trước 48h/i });
    fireEvent.click(flexibleBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationPolicy: expect.stringContaining('Nếu hủy trước 48 giờ trước ngày khởi hành: Bạn được hoàn 100% giá trị tour'),
      })
    );
  });

  it('dynamically generates policy text when editing milestone numbers (e.g. 1 ngày - hoàn 50%)', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Edit time on milestone 3
    const timeInput = screen.getByRole('spinbutton', { name: 'Số thời gian hủy mốc 3' });
    fireEvent.change(timeInput, { target: { value: '1' } });

    // Edit refund percent on milestone 3
    const refundInput = screen.getByRole('spinbutton', { name: 'Tỷ lệ hoàn tiền mốc 3' });
    fireEvent.change(refundInput, { target: { value: '50' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationPolicy: expect.stringContaining('Nếu hủy trước 1 ngày trước ngày khởi hành: Bạn được hoàn 50% giá trị tour'),
      })
    );
  });

  it('allows adding and removing milestone rows', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    const addBtn = screen.getByRole('button', { name: /Thêm mốc hoàn hủy/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('spinbutton', { name: 'Số thời gian hủy mốc 4' })).toBeDefined();

    const deleteBtn = screen.getByRole('button', { name: 'Xóa mốc 4' });
    fireEvent.click(deleteBtn);

    expect(screen.queryByRole('spinbutton', { name: 'Số thời gian hủy mốc 4' })).toBeNull();
  });

  it('allows free custom text editing in textarea and shows regeneration option', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    const textarea = screen.getByPlaceholderText(/Quy định hoàn tiền/i);
    fireEvent.change(textarea, { target: { value: 'Điều khoản đặc biệt: Vé máy bay không hoàn tiền.' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationPolicy: 'Điều khoản đặc biệt: Vé máy bay không hoàn tiền.',
      })
    );

    // Indicator switches to custom
    expect(screen.getByText('✏️ Đã chỉnh sửa thủ công')).toBeDefined();

    // Click regenerate
    const regenBtn = screen.getByRole('button', { name: /Tạo lại từ bảng mốc/i });
    fireEvent.click(regenBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationPolicy: expect.stringContaining('Nếu hủy trước 7 ngày'),
      })
    );
    expect(screen.getByText('✓ Tự động cập nhật theo các mốc')).toBeDefined();
  });

  it('toggles required documents checklist chips', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Click on concise CCCD chip
    const cccdChip = screen.getByRole('button', { name: /\+ CCCD \/ CMND/i });
    fireEvent.click(cccdChip);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredDocuments: expect.stringContaining('Căn cước công dân (CCCD) hoặc CMND bản gốc còn hiệu lực sử dụng'),
      })
    );
  });

  it('toggles travel notes checklist chips', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Click on concise travel note chip
    const noteChip = screen.getByRole('button', { name: /Trang phục lịch sự/i });
    fireEvent.click(noteChip);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        travelNotes: expect.stringContaining('Trang phục lịch sự, kín đáo'),
      })
    );
  });
});
