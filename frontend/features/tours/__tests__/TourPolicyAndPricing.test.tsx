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
  it('renders age group and percentage inputs when enabled', () => {
    const onChange = vi.fn();
    render(<TourAgePricingFields value={baseTour} onChange={onChange} />);

    expect(screen.getByText('Tuổi nhóm trẻ em')).toBeDefined();
    expect(screen.getByText('Tuổi nhóm người lớn')).toBeDefined();
    expect(screen.getByText('Giá trẻ em (% người lớn)')).toBeDefined();
    expect(screen.getByText('Giá em bé (% người lớn)')).toBeDefined();
  });

  it('appends child policy preset when clicked', () => {
    const onChange = vi.fn();
    render(<TourAgePricingFields value={baseTour} onChange={onChange} />);

    const chip = screen.getByRole('button', { name: /\+ Dưới 2 tuổi: Miễn phí/i });
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
    const flexibleBtn = screen.getByRole('button', { name: /Linh hoạt/i });
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

  it('does not display manual textarea and automatically syncs cancellation terms from milestones', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Manual textarea should not be present
    expect(screen.queryByPlaceholderText(/Quy định hoàn tiền/i)).toBeNull();
    expect(screen.queryByText('Nội dung điều khoản chi tiết:')).toBeNull();
  });

  it('toggles required documents checklist chips', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Click on concise CCCD chip
    const cccdChip = screen.getByRole('button', { name: /CCCD \/ CMND/i });
    fireEvent.click(cccdChip);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredDocuments: expect.stringContaining('Căn cước công dân (CCCD) hoặc CMND bản gốc còn hiệu lực sử dụng'),
      })
    );
  });

  it('allows user to enter custom travel notes directly into textarea without suggestion chips', () => {
    const onChange = vi.fn();
    render(<TourPolicyFields value={baseTour} onChange={onChange} includeAgePricing={false} />);

    // Chips should no longer exist for travel notes
    expect(screen.queryByRole('button', { name: /Trang phục lịch sự/i })).toBeNull();

    // Directly input travel notes
    const textarea = screen.getByPlaceholderText(/Trang phục lịch sự khi vào đền chùa/i);
    fireEvent.change(textarea, { target: { value: 'Lưu ý mang theo áo khoác ấm và giày thể thao' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        travelNotes: 'Lưu ý mang theo áo khoác ấm và giày thể thao',
      })
    );
  });
});
