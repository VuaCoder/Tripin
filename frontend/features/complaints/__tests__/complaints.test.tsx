import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComplaintTicketDialog } from '../components/ComplaintTicketDialog';
import { ComplaintCsatDialog } from '../components/ComplaintCsatDialog';
import { ComplaintButton } from '../components/ComplaintButton';
import { EmojiPicker } from '../components/EmojiPicker';

const mockCreateTicket = vi.fn();
const mockSubmitFeedback = vi.fn();

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({ id: 'u1', permissions: ['report:create'] }),
}));

vi.mock('../api/complaintsApi', () => ({
  useCreateComplaintImageSignatureMutation: () => [
    vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({ publicId: 'sig1' }) }),
    { isLoading: false },
  ],
  useCreateComplaintTicketMutation: () => [
    mockCreateTicket,
    { isLoading: false },
  ],
  useSubmitComplaintFeedbackMutation: () => [
    mockSubmitFeedback,
    { isLoading: false },
  ],
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ComplaintTicketDialog', () => {
  it('hiển thị danh mục phân cấp và thay đổi danh mục con tương ứng', () => {
    render(
      <ComplaintTicketDialog
        open={true}
        tourId="t1"
        tourTitle="Tour Ninh Bình 1 Ngày"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Mở phiếu khiếu nại dịch vụ tour')).toBeTruthy();
    expect(screen.getByText('Tour Ninh Bình 1 Ngày')).toBeTruthy();

    const categorySelect = screen.getByLabelText('1. Nhóm vấn đề chính') as HTMLSelectElement;
    expect(categorySelect.value).toBe('ITINERARY');

    // Đổi sang nhóm Phương tiện & Vận chuyển
    fireEvent.change(categorySelect, { target: { value: 'TRANSPORT' } });
    expect(categorySelect.value).toBe('TRANSPORT');

    const subSelect = screen.getByLabelText('2. Vấn đề chi tiết') as HTMLSelectElement;
    expect(subSelect.options.length).toBeGreaterThan(0);
  });

  it('chặn submit khi tiêu đề hoặc mô tả quá ngắn', async () => {
    render(
      <ComplaintTicketDialog
        open={true}
        tourId="t1"
        onClose={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Gửi phiếu khiếu nại' });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Vui lòng nhập tiêu đề tóm tắt/)).toBeTruthy();
    expect(mockCreateTicket).not.toHaveBeenCalled();
  });

  it('sử dụng Cloudinary Photo Picker và không có ô nhập dán link https://', () => {
    render(
      <ComplaintTicketDialog
        open={true}
        tourId="t1"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Hình ảnh / Bằng chứng thực tế')).toBeTruthy();
    expect(screen.getByText('Tải ảnh chụp từ thiết bị')).toBeTruthy();
    expect(screen.queryByPlaceholderText('https://...')).toBeNull();
    expect(screen.queryByText(/Hỗ trợ định dạng/)).toBeNull();
    expect(screen.queryByText(/Sau khi mở phiếu, một cuộc hội thoại 2 chiều/)).toBeNull();
  });
});

describe('ComplaintCsatDialog', () => {
  it('cho phép chấm sao và gửi đánh giá CSAT', async () => {
    mockSubmitFeedback.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 'fb1' }),
    });

    const onSuccess = vi.fn();
    render(
      <ComplaintCsatDialog
        open={true}
        ticketId="c1"
        ticketCode="CP-20261022-0001"
        agencyName="Đại lý An"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText('Đánh giá chất lượng hỗ trợ')).toBeTruthy();
    expect(screen.getByText('CP-20261022-0001')).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: 'Gửi đánh giá' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'c1',
          rating: 5,
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe('ComplaintButton', () => {
  it('hiển thị nút khiếu nại dịch vụ và mở modal khi bấm', () => {
    render(<ComplaintButton tourId="t1" tourTitle="Tour Đà Lạt" />);

    const btn = screen.getByRole('button', { name: /Khiếu nại dịch vụ/ });
    expect(btn).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.getByText('Mở phiếu khiếu nại dịch vụ tour')).toBeTruthy();
  });
});

describe('EmojiPicker', () => {
  it('hiển thị danh mục và gọi onSelect khi bấm vào một emoji', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);

    expect(screen.getByText('Biểu tượng cảm xúc (Emoji)')).toBeTruthy();

    // Click on emoji 😀
    const emojiBtn = screen.getByTitle('😀');
    expect(emojiBtn).toBeTruthy();
    fireEvent.click(emojiBtn);

    expect(onSelect).toHaveBeenCalledWith('😀');
  });

  it('cho phép chuyển tab danh mục hoặc đóng khi nhấn phím Escape', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<EmojiPicker onSelect={onSelect} onClose={onClose} />);

    // Switch to Cử chỉ
    const gesturesTab = screen.getByTitle('Cử chỉ');
    fireEvent.click(gesturesTab);

    expect(screen.getByTitle('👍')).toBeTruthy();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

