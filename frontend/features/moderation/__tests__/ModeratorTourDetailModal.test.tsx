import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModeratorTourDetailModal } from '../components/ModeratorTourDetailModal';
import type { ModerationTourDetail } from '../types';

const mockTourDetailQuery = vi.fn();

vi.mock('../api/moderationApi', () => ({
  useGetModerationTourQuery: (...args: unknown[]) => mockTourDetailQuery(...args),
}));

const sampleTourDetail: ModerationTourDetail = {
  id: 'tour-123',
  title: 'Hạ Long 3N2Đ Siêu Cấp',
  summary: 'Khám phá vịnh Hạ Long kỳ vĩ',
  description: 'Chuyến đi 3 ngày 2 đêm đầy thú vị với du thuyền 5 sao đẳng cấp quốc tế.',
  destination: 'Quảng Ninh',
  durationDays: 3,
  basePrice: 2500000,
  maxGroupSize: 30,
  meetingPoint: 'Cảng tàu khách quốc tế Tuần Châu',
  coverImage: 'https://example.com/halong-cover.jpg',
  images: [
    'https://example.com/halong-cover.jpg',
    'https://example.com/halong-1.jpg',
    'https://example.com/halong-2.jpg',
  ],
  highlights: ['Nghỉ đêm du thuyền 5 sao', 'Chèo kayak vịnh Lan Hạ', 'Thưởng thức hải sản tươi sống'],
  status: 'PENDING_REVIEW',
  statusReason: 'Ảnh bìa chưa đạt tiêu chuẩn ở lần nộp trước',
  submittedAt: '2026-11-15T01:30:00.000Z',
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-15T01:30:00.000Z',
  agency: {
    id: 'agency-1',
    name: 'Bánh Giò Travel',
  },
  itinerary: [
    {
      day: 1,
      title: 'Hà Nội – Hạ Long',
      description: 'Xe đón quý khách tại điểm hẹn khởi hành đi Hạ Long.',
      activities: ['Check-in du thuyền', 'Ăn trưa buffet', 'Thăm hang Sửng Sốt'],
    },
    {
      day: 2,
      toDay: 3,
      title: 'Vịnh Lan Hạ – Trở về Hà Nội',
      description: 'Tập thái cực quyền buổi sáng và chèo thuyền kayak.',
      activities: ['Tập Taichi', 'Chèo kayak', 'Thưởng thức bữa trưa nhẹ'],
    },
  ],
  agePricing: {
    childMinAge: 2,
    adultMinAge: 13,
    childPercent: 60,
    infantPercent: 0,
    childPrice: 1500000,
    infantPrice: 0,
  },
  childPricingPolicy: 'Trẻ em dưới 2 tuổi miễn phí 100%, từ 2-12 tuổi tính 60% vé.',
  departures: [
    {
      id: 'dep-1',
      date: '2026-12-01T08:00:00.000Z',
      capacity: 30,
      bookedCount: 10,
      remaining: 20,
      price: 2500000,
      isOpen: true,
    },
  ],
  inclusions: ['Xe đưa đón khứ hồi', 'Ăn uống theo chương trình', 'Vé tham quan các điểm'],
  exclusions: ['Chi phí cá nhân', 'Đồ uống có cồn', 'Tiền tip hướng dẫn viên'],
  optionalServices: [
    {
      id: 'opt-1',
      kind: 'PICKUP',
      name: 'Đưa đón tận nơi tại Hà Nội',
      description: 'Xe limousine 9 chỗ đón tận cửa khách sạn',
      price: 200000,
      unit: 'người',
      pricing: 'PER_PERSON',
      active: true,
      pickup: {
        area: 'Phố Cổ Hà Nội',
        mode: 'ROUND_TRIP',
      },
    },
  ],
  cancellationPolicy: 'Hủy trước 7 ngày hoàn 100% tiền cọc.',
  requiredDocuments: 'CCCD gắn chip hoặc Hộ chiếu còn hạn trên 6 tháng.',
  travelNotes: 'Nên mang theo kem chống nắng, đồ bơi và giày thể thao thoải mái.',
};

describe('ModeratorTourDetailModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders tour header, tabs, and overview content with gallery', () => {
    mockTourDetailQuery.mockReturnValue({ data: sampleTourDetail, isLoading: false, isError: false });

    render(
      <ModeratorTourDetailModal
        tourId="tour-123"
        canValidate={true}
        canSuspend={false}
        isSubmitting={false}
        serverError={null}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onSuspend={vi.fn()}
      />,
    );

    // Title and agency info
    expect(screen.getByText('Hạ Long 3N2Đ Siêu Cấp')).toBeTruthy();
    expect(screen.getByText('Bánh Giò Travel')).toBeTruthy();
    expect(screen.getByText(/Điểm tập trung khởi hành/)).toBeTruthy();
    expect(screen.getByText('Cảng tàu khách quốc tế Tuần Châu')).toBeTruthy();
    expect(screen.getByText(/Ảnh bìa chưa đạt tiêu chuẩn/)).toBeTruthy();
    expect(screen.getByText('Nghỉ đêm du thuyền 5 sao')).toBeTruthy();
  });

  it('switches tabs to inspect itinerary, pricing, services, and policies', () => {
    mockTourDetailQuery.mockReturnValue({ data: sampleTourDetail, isLoading: false, isError: false });

    render(
      <ModeratorTourDetailModal
        tourId="tour-123"
        canValidate={true}
        canSuspend={false}
        isSubmitting={false}
        serverError={null}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onSuspend={vi.fn()}
      />,
    );

    // Click Itinerary tab
    fireEvent.click(screen.getByText('Lịch trình'));
    expect(screen.getByText('Hà Nội – Hạ Long')).toBeTruthy();
    expect(screen.getByText('Vịnh Lan Hạ – Trở về Hà Nội')).toBeTruthy();
    expect(screen.getByText('Thăm hang Sửng Sốt')).toBeTruthy();

    // Click Pricing tab
    fireEvent.click(screen.getByText('Giá vé & Sức chứa'));
    expect(screen.getByText(/Chính sách giá theo/)).toBeTruthy();
    expect(screen.getByText('Trẻ em (2 – 12 tuổi)')).toBeTruthy();
    expect(screen.getByText('20 chỗ')).toBeTruthy(); // Remaining slots

    // Click Services tab
    fireEvent.click(screen.getByText('Dịch vụ đi kèm'));
    expect(screen.getByText(/Dịch vụ bao gồm/)).toBeTruthy();
    expect(screen.getByText('Xe đưa đón khứ hồi')).toBeTruthy();
    expect(screen.getByText(/Dịch vụ không bao gồm/)).toBeTruthy();
    expect(screen.getByText('Chi phí cá nhân')).toBeTruthy();
    expect(screen.getByText('Đưa đón tận nơi tại Hà Nội')).toBeTruthy();

    // Click Policies tab
    fireEvent.click(screen.getByText('Chính sách & Hướng dẫn'));
    expect(screen.getByText('Chính sách hoàn hủy tour')).toBeTruthy();
    expect(screen.getByText(/Hủy trước 7 ngày/)).toBeTruthy();
    expect(screen.getByText(/CCCD gắn chip/)).toBeTruthy();
  });

  it('validates reason when rejecting tour and calls onApprove without mandatory reason', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onReject = vi.fn().mockResolvedValue(undefined);
    mockTourDetailQuery.mockReturnValue({ data: sampleTourDetail, isLoading: false, isError: false });

    render(
      <ModeratorTourDetailModal
        tourId="tour-123"
        canValidate={true}
        canSuspend={false}
        isSubmitting={false}
        serverError={null}
        onClose={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
        onSuspend={vi.fn()}
      />,
    );

    // Reject without reason
    fireEvent.click(screen.getByText('Từ chối'));
    expect(screen.getByText(/ít nhất 3 ký tự/)).toBeTruthy();
    expect(onReject).not.toHaveBeenCalled();

    // Type reason and reject
    const textarea = screen.getByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: 'Chưa đủ giấy phép yêu cầu' } });
    fireEvent.click(screen.getByText('Từ chối'));
    expect(onReject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('Chưa đủ giấy phép yêu cầu'));

    // Approve tour
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByText('Duyệt tour'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt tour' }));
    await waitFor(() => expect(onApprove).toHaveBeenCalled());
  });
});
