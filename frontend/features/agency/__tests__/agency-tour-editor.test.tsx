import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgencyTourEditorPage } from '@/features/tours/components/AgencyTourEditorPage';
import { validateTourEditor } from '@/features/tours/components/tourEditorValidation';

const mocks = vi.hoisted(() => ({ 
  save: vi.fn(), 
  push: vi.fn(), 
  replace: vi.fn(),
  tourData: { current: null as any },
  memberRole: { current: 'OWNER' as 'OWNER' | 'STAFF' },
  fromUrl: { current: '' as string }
}));

vi.mock('next/navigation', () => ({ 
  useParams: () => ({ id: 'tour-123' }), 
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => ({ get: (param: string) => (param === 'from' ? mocks.fromUrl.current : null) })
}));

vi.mock('@/features/tours/api/toursApi', () => ({
  useGetAgencyTourQuery: () => ({ data: mocks.tourData.current, isLoading: false }),
  useGetTourCategoriesQuery: () => ({ data: [{ id: 'cat-1', name: 'Khám phá' }] }),
  useCreateAgencyTourMutation: () => [mocks.save, {}], 
  useUpdateAgencyTourMutation: () => [mocks.save, {}],
  useUploadAgencyTourImageMutation: () => [vi.fn(), {}],
  useCreateAgencyCategoryMutation: () => [vi.fn(), {}],
  getTourApiMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock('@/features/agency/agencyContext', () => ({ useAgencyContext: () => ({ memberRole: mocks.memberRole.current }) }));
vi.mock('@/features/agency/agencyNotice', () => ({ agencyNotice: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/features/tours/components/AgencyTourLivePreview', () => ({ AgencyTourLivePreview: () => null }));

beforeEach(() => { 
  mocks.save.mockReset(); 
  mocks.push.mockReset(); 
  mocks.replace.mockReset(); 
  mocks.tourData.current = null;
  mocks.memberRole.current = 'OWNER';
  mocks.fromUrl.current = '';
});
afterEach(cleanup);

function completeRequiredFields() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên tour' }), { target: { value: 'Khám phá Hạ Long' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Điểm đến chính' }), { target: { value: 'Quảng Ninh' } });
  fireEvent.focus(screen.getByPlaceholderText(/Tìm hoặc nhập danh mục tour/i));
  fireEvent.click(screen.getByRole('button', { name: /Khám phá/i }));
  fireEvent.change(screen.getByLabelText('Giá người lớn · từ 13 tuổi trở lên (VND)'), { target: { value: '1.000.000' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Tạo tour & Tiếp tục' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo tour' }));
}

describe('Tour editor inline reminders', () => {
  it('moves to the next field with Enter and keeps Shift+Enter for textarea newlines', () => {
    render(<AgencyTourEditorPage mode="create" />);
    const title = screen.getByRole('textbox', { name: 'Tên tour' });
    const description = screen.getByRole('textbox', { name: 'Mô tả tour' });
    const days = screen.getByRole('spinbutton', { name: 'Thời lượng (Số ngày)' });
    const summary = screen.getByRole('textbox', { name: 'Tóm tắt ngắn' });
    title.focus();
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(document.activeElement).toBe(description);
    fireEvent.keyDown(description, { key: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(description);
    fireEvent.keyDown(description, { key: 'Enter' });
    expect(document.activeElement?.getAttribute('name')).toBe('destination');
    days.focus();
    fireEvent.keyDown(days, { key: 'Enter' });
    expect(document.activeElement).toBe(summary);
  });

  it('blocks direct creation for staff while preserving edit access', () => {
    mocks.memberRole.current = 'STAFF';
    render(<AgencyTourEditorPage mode="create" />);
    expect(screen.getByRole('alert').textContent).toContain('Chỉ Chủ đại lý hoặc Quản lý');
    expect(screen.queryByRole('button', { name: 'Tạo tour & Tiếp tục' })).toBeNull();
  });

  it('shows locked tour details instead of disabled edit fields', () => {
    mocks.tourData.current = { id: 'tour-123', status: 'PENDING_REVIEW' };
    render(<AgencyTourEditorPage mode="edit" />);
    expect(screen.getByRole('heading', { name: 'Chưa thể sửa nội dung tour' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Xem chi tiết tour' }).getAttribute('href')).toBe('/agency/tours/tour-123');
    expect(screen.queryByRole('textbox', { name: 'Tên tour' })).toBeNull();
  });

  it('shows errors below fields after continuing, clears corrected errors and labels optional fields without red asterisks', () => {
    const { container } = render(<AgencyTourEditorPage mode="create" />);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạo tour & Tiếp tục' })[0]);
    const title = screen.getByRole('textbox', { name: 'Tên tour' });
    const hint = document.getElementById(title.getAttribute('aria-describedby')!);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(hint?.textContent).toContain('5 đến 200');
    expect(title.parentElement?.contains(hint)).toBe(true);
    expect(container.querySelectorAll('label .text-red-600')).toHaveLength(0);
    expect(screen.getByText(/Tóm tắt ngắn/i)).toBeDefined();
    expect(screen.getByRole('group', { name: /Danh mục/i }).getAttribute('aria-invalid')).toBe('true');
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: 'Khám phá Hạ Long' } });
    expect(title.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByText('Nhập tên tour từ 5 đến 200 ký tự nhé.')).toBeNull();
  });

  it('does not render guide assignment while creating a tour', () => {
    render(<AgencyTourEditorPage mode="create" />);
    expect(screen.queryByText('Hướng dẫn viên phụ trách')).toBeNull();
  });

  it('validates on blur and rejects fractional days locally', () => {
    render(<AgencyTourEditorPage mode="create" />);
    const days = screen.getByRole('spinbutton', { name: 'Thời lượng (Số ngày)' });
    fireEvent.change(days, { target: { value: '1.5' } });
    fireEvent.blur(days);
    expect(screen.getByRole('alert').textContent).toContain('không dùng số lẻ');
    fireEvent.change(days, { target: { value: '2' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('places server field errors below the right input and preserves all entered data', async () => {
    mocks.save.mockReturnValue({ unwrap: () => Promise.reject({ data: { error: { details: [{ location: 'body', path: 'destination', message: 'Invalid destination' }] } } }) });
    render(<AgencyTourEditorPage mode="create" />);
    completeRequiredFields();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Điểm đến chưa hợp lệ'));
    const destination = screen.getByRole('textbox', { name: 'Điểm đến chính' }) as HTMLInputElement;
    expect(destination.value).toBe('Quảng Ninh');
    expect(destination.parentElement?.contains(screen.getByRole('alert'))).toBe(true);
    expect(mocks.replace).not.toHaveBeenCalled();
  }, 15000);

  it('puts network failures below the active step without discarding data', async () => {
    mocks.save.mockReturnValue({ unwrap: () => Promise.reject({ status: 'FETCH_ERROR' }) });
    const { container } = render(<AgencyTourEditorPage mode="create" />);
    completeRequiredFields();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Dữ liệu của bạn vẫn còn'));
    expect(container.querySelector('form')?.contains(screen.getByRole('alert'))).toBe(true);
    expect(mocks.replace).not.toHaveBeenCalled();
  }, 15000);

  it('validates category, price and capacity limits', () => {
    const errors = validateTourEditor({ title: 'Tour hợp lệ', destination: 'Huế', durationDays: 366, categoryIds: [], basePrice: -1, maxGroupSize: 10001 });
    expect(Object.keys(errors).sort()).toEqual(['basePrice', 'categoryIds', 'durationDays', 'maxGroupSize']);
  });

  it('renders multi-step navigation stepper and allows navigating across steps', () => {
    render(<AgencyTourEditorPage mode="create" />);
    
    // Stepper should render all 4 steps
    const nav = screen.getByRole('navigation', { name: 'Các bước tạo tour' });
    expect(within(nav).getByRole('button', { name: /Thông tin chung/i })).toBeDefined();
    expect(within(nav).getByRole('button', { name: /Hình ảnh tour/i })).toBeDefined();
    expect(within(nav).getByRole('button', { name: /Giá & Dịch vụ/i })).toBeDefined();
    expect(within(nav).getByRole('button', { name: /Chính sách/i })).toBeDefined();

    // Clicking step 2 tab directly switches to step 2
    fireEvent.click(within(nav).getByRole('button', { name: /Hình ảnh tour/i }));
    const step2Sec = document.getElementById('tour-section-2');
    expect(step2Sec?.className).toContain('block');
    const step1Sec = document.getElementById('tour-section-1');
    expect(step1Sec?.className).toContain('hidden');

    // Clicking "Quay lại" moves back to step 1
    fireEvent.click(within(step2Sec!).getByRole('button', { name: /^Quay lại$/i }));
    expect(step1Sec?.className).toContain('block');
    expect(step2Sec?.className).toContain('hidden');
  });
});

describe('Tour editor edit mode & unsaved changes handling', () => {
  const existingTour = {
    id: 'tour-123',
    title: 'Tour Ba Bể Bắc Kạn',
    summary: 'Chuyến đi 3 ngày',
    description: 'Chi tiết tour',
    destination: 'Bắc Kạn',
    durationDays: 3,
    basePrice: 2500000,
    maxGroupSize: 15,
    categoryIds: ['cat-1'],
    images: ['https://images.unsplash.com/photo-1528127269322-539801943592'],
    inclusions: ['Xe đưa đón'],
    exclusions: ['Chi phí cá nhân'],
    cancellationPolicy: 'Hủy trước 7 ngày được hoàn 50%.',
    status: 'DRAFT',
  };

  it('locks pricing and sends only allowed changed fields for STAFF', async () => {
    mocks.memberRole.current = 'STAFF';
    mocks.tourData.current = existingTour;
    mocks.save.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'tour-123' }) });
    render(<AgencyTourEditorPage mode="edit" />);
    expect(screen.getByText(/Chỉ Quản lý \(Manager\) hoặc Chủ đại lý/)).toBeDefined();
    const price = screen.getByLabelText(/Giá người lớn/) as HTMLInputElement;
    expect(price.closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByText('Chính sách hủy hoàn · Chỉ xem')).toBeDefined();
    expect(screen.getByText('Hủy trước 7 ngày được hoàn 50%.')).toBeDefined();
    expect(screen.queryByText('Chọn nhanh chính sách đề xuất:')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên tour' }), { target: { value: 'Tour Staff cập nhật' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Hủy' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu rồi thoát' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ id: 'tour-123', body: { title: 'Tour Staff cập nhật' } }));
  });

  it('disables save button with "Chưa có thay đổi" when tour content is unchanged in edit mode', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const buttons = screen.getAllByRole('button', { name: 'Chưa có thay đổi' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);

    // Clicking it should not call save
    fireEvent.click(buttons[0]);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('enables save button as soon as an edit is made in edit mode', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Ba Bể Bắc Kạn Mới' } });

    const saveButtons = screen.getAllByRole('button', { name: 'Lưu thay đổi' });
    expect(saveButtons.length).toBeGreaterThanOrEqual(1);
    expect((saveButtons[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it('exits directly to tour list (/agency/tours) without confirmation dialog when no changes have been made', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    // Should navigate to tour list by default
    expect(mocks.push).toHaveBeenCalledWith('/agency/tours');
    expect(screen.queryByText('Bạn có thay đổi chưa lưu!')).toBeNull();
  });

  it('shows confirmation modal with 3 choices when cancelling with unsaved changes', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Đã Chỉnh Sửa' } });

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    // Modal appears
    expect(screen.getByText('Bạn có thay đổi chưa lưu!')).toBeDefined();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Thoát không lưu' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Lưu rồi thoát' })).toBeDefined();
  });

  it('navigates to tour list without saving when "Thoát không lưu" is clicked', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Đã Chỉnh Sửa' } });

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Thoát không lưu' }));
    expect(mocks.push).toHaveBeenCalledWith('/agency/tours');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('saves tour and navigates to tour list when "Lưu rồi thoát" is clicked', async () => {
    mocks.tourData.current = existingTour;
    mocks.save.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'tour-123' }) });
    render(<AgencyTourEditorPage mode="edit" />);

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Đã Chỉnh Sửa Hợp Lệ' } });

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu rồi thoát' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith('/agency/tours');
  });

  it('navigates back to custom fromUrl (e.g. workspace) when from param is present', async () => {
    mocks.tourData.current = existingTour;
    mocks.fromUrl.current = '/agency/tours/tour-123';
    mocks.save.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'tour-123' }) });
    render(<AgencyTourEditorPage mode="edit" />);

    // Circular back button with aria-label "Quay lại trang trước"
    expect(screen.getByRole('button', { name: 'Quay lại trang trước' })).toBeDefined();

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Đã Chỉnh Sửa Hợp Lệ' } });

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu rồi thoát' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith('/agency/tours/tour-123');
  });

  it('exits to default route when circular back button is clicked without changes', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const backBtn = screen.getByRole('button', { name: 'Quay lại trang trước' });
    fireEvent.click(backBtn);

    expect(mocks.push).toHaveBeenCalledWith('/agency/tours');
  });

  it('closes modal and stays on page when "Hủy" inside modal is clicked', () => {
    mocks.tourData.current = existingTour;
    render(<AgencyTourEditorPage mode="edit" />);

    const titleInput = screen.getByRole('textbox', { name: 'Tên tour' });
    fireEvent.change(titleInput, { target: { value: 'Tour Đã Chỉnh Sửa' } });

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButtons[0]);

    expect(screen.getByText('Bạn có thay đổi chưa lưu!')).toBeDefined();

    // Click "Hủy" inside dialog
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByText('Bạn có thay đổi chưa lưu!')).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('edits adult, child, and infant max counts in step 3 dropdown and sends updated maxGroupSize + agePricing', async () => {
    mocks.tourData.current = {
      ...existingTour,
      maxGroupSize: 15,
      agePricing: {
        childMinAge: 2,
        adultMinAge: 13,
        childPercent: 100,
        infantPercent: 100,
        childPrice: 1200000,
        infantPrice: 0,
        adultMaxCount: 10,
        childMaxCount: 4,
        infantMaxCount: 1,
      },
    };
    mocks.save.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'tour-123' }) });
    render(<AgencyTourEditorPage mode="edit" />);

    const capacityTrigger = screen.getByRole('button', { name: 'Số khách tối đa / đoàn' });
    expect(capacityTrigger.textContent).toContain('15 khách (10 người lớn, 4 trẻ em, 1 em bé)');
    fireEvent.click(capacityTrigger);

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Số người lớn' })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số người lớn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số em bé' }));

    const saveButtons = screen.getAllByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(saveButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const savedPayload = mocks.save.mock.calls[0][0];
    expect(savedPayload.body.maxGroupSize).toBe(17);
    expect(savedPayload.body.agePricing).toEqual(expect.objectContaining({
      adultMaxCount: 11,
      childMaxCount: 4,
      infantMaxCount: 2,
      childPrice: 1200000,
      infantPrice: 0,
    }));
  });
});
