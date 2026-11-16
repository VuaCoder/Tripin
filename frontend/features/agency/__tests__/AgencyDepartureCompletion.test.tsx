import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartureCompletion } from '../completionApi';

const mock = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn(), upload: vi.fn(), memberRole: 'OWNER', permission: true }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('departureId=departure') }));
vi.mock('@/store/hooks', () => ({ useAppSelector: () => ({ memberRole: mock.memberRole }) }));
vi.mock('../AgencyCommon', async original => ({ ...await original<typeof import('../AgencyCommon')>(), useAgencyPermission: () => mock.permission }));
vi.mock('../completionApi', () => ({ useDepartureCompletionQuery: mock.query, useSaveCompletionMutation: () => [mock.save, { isLoading: false }], useUploadCompletionImageMutation: () => [mock.upload] }));
import { AgencyCompletionReportModal } from '../AgencyCompletionReportModal';
const Subject = () => <AgencyCompletionReportModal scope={{ tourId: 'tour', departureId: 'departure' }} onClose={() => {}} />;

const data: DepartureCompletion = { id: 'completion', revision: 0, scheduledEndAt: '2020-01-03T08:00:00Z', completedAt: null,
  bookedServices: [{ key: 'a'.repeat(64), serviceId: 'pickup', name: 'Đưa đón sân bay', unit: 'khách', quantity: 3, bookingCount: 1 }],
  snapshot: { title: 'Tour', departureAt: '2020-01-01T08:00:00Z' }, reports: [],
  bookings: [{ id: 'booking', bookingCode: 'TRP-01', participants: 50, attendedParticipants: null, status: 'CONFIRMED' }] };
beforeEach(() => { mock.memberRole = 'OWNER'; mock.permission = true; mock.query.mockReturnValue({ currentData: structuredClone(data) }); mock.save.mockReset(); mock.upload.mockReset(); });
afterEach(cleanup);

describe('Agency close-out report', () => {
  it('uses booked add-ons and shows an explicit empty state instead of generic tour services', () => {
    const view = render(<Subject />);
    expect(screen.getByLabelText('Đưa đón sân bay')).toBeTruthy();
    expect(screen.getByText('Đã đặt 3 khách · 1 booking')).toBeTruthy();
    expect(screen.queryByLabelText('Phương tiện di chuyển')).toBeNull();
    expect(screen.queryByLabelText('Hướng dẫn viên')).toBeNull();
    view.unmount();
    mock.query.mockReturnValue({ currentData: { ...data, bookedServices: [] } });
    render(<Subject />);
    expect(screen.getByText('Không có dịch vụ mua thêm trong các booking của chuyến đi.')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
  it('uploads images from disk, preserves them in a draft, and saves the full report', async () => {
    mock.upload.mockReturnValue({ unwrap: () => Promise.resolve({ url: 'https://res.cloudinary.com/test/report.jpg', publicId: 'report' }) });
    mock.save.mockReturnValue({ unwrap: () => Promise.resolve({ ...data, revision: 1 }) });
    render(<Subject />);
    const image = new File(['image'], 'tour.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Tải ảnh từ máy'), { target: { files: [image] } });
    await screen.findByAltText('Ảnh minh chứng 1');
    expect(mock.upload).toHaveBeenCalledWith(image);
    fireEvent.click(screen.getByLabelText('Không có thay đổi'));
    fireEvent.change(screen.getByLabelText(/3. Thay đổi so với kế hoạch/), { target: { value: 'Đổi lịch tham quan vì trời mưa, đã bố trí hoạt động trong nhà.' } });
    fireEvent.change(screen.getByLabelText(/8. Ghi chú bổ sung/), { target: { value: 'Đã bàn giao hành lý đầy đủ.' } });
    fireEvent.change(screen.getByLabelText('Đưa đón sân bay'), { target: { value: 'PROVIDED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ report: expect.objectContaining({
      noChanges: false, noIncidents: true, changes: expect.stringContaining('Đổi lịch'),
      additionalNotes: 'Đã bàn giao hành lý đầy đủ.', evidence: ['https://res.cloudinary.com/test/report.jpg'], serviceConfirmations: [{ key: 'a'.repeat(64), status: 'PROVIDED' }],
    }) })));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh 1' }));
    expect(screen.queryByAltText('Ảnh minh chứng 1')).toBeNull();
  });

  it('rejects invalid images and preserves successful uploads if a later file fails', async () => {
    render(<Subject />);
    fireEvent.change(screen.getByLabelText('Tải ảnh từ máy'), { target: { files: [new File(['pdf'], 'test.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByRole('alert').textContent).toContain('5 MB');
    expect(mock.upload).not.toHaveBeenCalled();
    mock.upload.mockReturnValueOnce({ unwrap: () => Promise.resolve({ url: 'https://res.cloudinary.com/test/ok.png' }) })
      .mockReturnValueOnce({ unwrap: () => Promise.reject({}) });
    fireEvent.change(screen.getByLabelText('Tải ảnh từ máy'), { target: { files: [new File(['1'], 'one.png', { type: 'image/png' }), new File(['2'], 'two.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Các ảnh đã tải thành công vẫn được giữ'));
    expect(screen.getByAltText('Ảnh minh chứng 1')).toBeTruthy();
  });

  it('requires service confirmation before submit and keeps saved images when amending', async () => {
    mock.query.mockReturnValue({ currentData: { ...data, completedAt: '2020-01-04T00:00:00Z', reports: [{ id: 'report', revision: 1, createdAt: '2020-01-04T00:00:00Z', submitted: true, payload: { summary: 'Chuyến đi đã hoàn tất đầy đủ.', changes: '', incidents: '', attendance: [], evidence: ['https://res.cloudinary.com/test/saved.jpg'] } }] } });
    render(<Subject />);
    expect(screen.getByAltText('Ảnh minh chứng 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bổ sung báo cáo' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Gửi bản bổ sung' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('dịch vụ mua thêm');
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bổ sung' }));
    expect(screen.getByAltText('Ảnh minh chứng 1')).toBeTruthy();
  });

  it('opens the departure from the notification, saves a draft and submits actual report/attendance', async () => {
    mock.save.mockReturnValue({ unwrap: () => Promise.resolve({ ...data, revision: 1 }) });
    render(<Subject />);
    fireEvent.change(screen.getByLabelText(/Tổng kết chuyến đi/), { target: { value: 'Đã thực hiện đầy đủ lịch trình chuyến đi.' } });
    expect(screen.queryByLabelText(/Giờ kết thúc thực tế/)).toBeNull();
    expect(screen.queryByLabelText('Đợt khởi hành')).toBeNull();
    expect(screen.queryByText('TRP-01')).toBeNull();
    expect(screen.queryByLabelText(/Liên kết ảnh/)).toBeNull();
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Người lớn thực tế'), { target: { value: '49' } });
    fireEvent.change(screen.getByLabelText(/5. Khách vắng mặt/), { target: { value: 'Một khách vắng mặt đã được xác nhận.' } });
    fireEvent.change(screen.getByLabelText('Đưa đón sân bay'), { target: { value: 'PROVIDED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ submit: false, tourId: 'tour', departureId: 'departure', report: expect.objectContaining({ actualParticipants: 49, attendance: [], actualEndAt: null, evidence: [] }) })));
    await screen.findByText('Đã lưu bản nháp.');
    fireEvent.submit(screen.getByRole('button', { name: 'Gửi báo cáo & hoàn tất' }).closest('form')!);
    await waitFor(() => expect(mock.save).toHaveBeenLastCalledWith(expect.objectContaining({ submit: true, report: expect.objectContaining({ expectedRevision: 1 }) })));
  });

  it('keeps entered content when the server rejects a save', async () => {
    mock.save.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { message: 'Booking vừa thay đổi.' } } }) });
    render(<Subject />);
    fireEvent.change(screen.getByLabelText(/Tổng kết chuyến đi/), { target: { value: 'Nội dung cần được giữ lại khi lưu thất bại.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText(/Tổng kết chuyến đi/) as HTMLTextAreaElement).value).toContain('Nội dung cần được giữ lại');
  });

  it('locks submitted reports and only enables an amendment with a reason', () => {
    mock.query.mockReturnValue({ currentData: { ...data, completedAt: '2020-01-04T00:00:00Z' } });
    render(<Subject />);
    expect((screen.getByLabelText(/Tổng kết chuyến đi/) as HTMLTextAreaElement).disabled || screen.getByLabelText(/Tổng kết chuyến đi/).closest('fieldset')?.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bổ sung báo cáo' }));
    expect(screen.getByLabelText('Người lớn thực tế').closest('fieldset')?.disabled).toBe(false);
    expect((screen.getByLabelText('Người lớn thực tế') as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Người lớn thực tế'), { target: { value: '49' } });
    expect((screen.getByLabelText('Người lớn thực tế') as HTMLInputElement).value).toBe('49');
    expect(screen.getByLabelText('Lý do bổ sung')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi bản bổ sung' })).toBeTruthy();
  });

  it('does not fetch report data for staff', () => {
    mock.query.mockClear(); mock.memberRole = 'STAFF';
    render(<Subject />);
    expect(mock.query).not.toHaveBeenCalled();
    expect(screen.queryByText('Báo cáo & hoàn tất chuyến đi')).toBeNull();
  });

  it('rejects a missing or oversized total without submitting', () => {
    render(<Subject />);
    fireEvent.change(screen.getByLabelText('Người lớn thực tế'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(screen.getByRole('alert').textContent).toContain('từng nhóm');
    fireEvent.change(screen.getByLabelText('Người lớn thực tế'), { target: { value: '51' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('submits and displays adults, children and infants separately', async () => {
    mock.query.mockReturnValue({ currentData: { ...data, bookedGuests: { adults: 5, children: 2, infants: 1 }, bookings: [{ ...data.bookings[0], participants: 8 }] } });
    mock.save.mockReturnValue({ unwrap: () => Promise.resolve({ ...data, revision: 1 }) });
    render(<Subject />);
    expect((screen.getByLabelText('Người lớn thực tế') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('Trẻ em thực tế') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Em bé thực tế') as HTMLInputElement).value).toBe('1');
    fireEvent.change(screen.getByLabelText('Trẻ em thực tế'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledWith(expect.objectContaining({ report: expect.objectContaining({ actualParticipants: 7, actualGuests: { adults: 5, children: 1, infants: 1 } }) })));
  });
  it('does not guess age counts from a partial total in an older mixed-age draft', () => {
    mock.query.mockReturnValue({ currentData: { ...data, bookedGuests: { adults: 5, children: 2, infants: 1 }, bookings: [{ ...data.bookings[0], participants: 8 }],
      reports: [{ payload: { actualParticipants: 6, attendance: [], summary: '', changes: '', incidents: '' } }] } });
    render(<Subject />);
    expect((screen.getByLabelText('Người lớn thực tế') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Trẻ em thực tế') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Em bé thực tế') as HTMLInputElement).value).toBe('');
  });
  it('keeps older submitted totals readable without inventing an age breakdown', () => {
    mock.query.mockReturnValue({ currentData: { ...data, completedAt: '2020-01-04T00:00:00Z', bookedGuests: { adults: 5, children: 2, infants: 1 }, bookings: [{ ...data.bookings[0], participants: 8 }],
      reports: [{ id: 'old-report', revision: 1, createdAt: '2020-01-04T00:00:00Z', submitted: true, payload: { actualParticipants: 6, attendance: [], summary: 'Báo cáo lịch sử đã gửi trước đây.', changes: '', incidents: '' } }] } });
    render(<Subject />);
    expect(screen.getByText(/Báo cáo cũ chỉ ghi nhận tổng/)).toBeTruthy();
    expect(screen.queryByLabelText('Người lớn thực tế')).toBeNull();
  });
});
