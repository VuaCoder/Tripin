import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgencyTourEditorPage } from '@/features/tours/components/AgencyTourEditorPage';
import { validateTourEditor } from '@/features/tours/components/tourEditorValidation';

const mocks = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({}), useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('@/features/tours/api/toursApi', () => ({
  useGetAgencyTourQuery: () => ({}),
  useGetTourCategoriesQuery: () => ({ data: [{ id: 'cat-1', name: 'Khám phá' }] }),
  useCreateAgencyTourMutation: () => [mocks.save, {}], useUpdateAgencyTourMutation: () => [mocks.save, {}],
  getTourApiMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock('@/features/tours/components/AgencyTourLivePreview', () => ({ AgencyTourLivePreview: () => null }));

beforeEach(() => { mocks.save.mockReset(); mocks.push.mockReset(); mocks.replace.mockReset(); });
afterEach(cleanup);

function completeRequiredFields() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Tên tour' }), { target: { value: 'Khám phá Hạ Long' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Điểm đến chính' }), { target: { value: 'Quảng Ninh' } });
  fireEvent.click(screen.getByRole('button', { name: 'Khám phá' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Giá cơ bản (VND)' }), { target: { value: '1000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn thiện' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
}

describe('Tour editor inline reminders', () => {
  it('shows errors below fields after continuing, clears corrected errors and renders red required marks', () => {
    const { container } = render(<AgencyTourEditorPage mode="create" />);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    const title = screen.getByRole('textbox', { name: 'Tên tour' });
    const hint = document.getElementById(title.getAttribute('aria-describedby')!);
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(hint?.textContent).toContain('5 đến 200');
    expect(title.parentElement?.contains(hint)).toBe(true);
    expect(container.querySelectorAll('label .text-red-600')).toHaveLength(3);
    expect(screen.getByRole('group').getAttribute('aria-invalid')).toBe('true');
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: 'Khám phá Hạ Long' } });
    expect(title.getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByText('Nhập tên tour từ 5 đến 200 ký tự nhé.')).toBeNull();
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
  });

  it('puts network failures below the active step without discarding data', async () => {
    mocks.save.mockReturnValue({ unwrap: () => Promise.reject({ status: 'FETCH_ERROR' }) });
    const { container } = render(<AgencyTourEditorPage mode="create" />);
    completeRequiredFields();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Dữ liệu của bạn vẫn còn'));
    expect(container.querySelector('form')?.contains(screen.getByRole('alert'))).toBe(true);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('validates category, price and capacity limits', () => {
    const errors = validateTourEditor({ title: 'Tour hợp lệ', destination: 'Huế', durationDays: 366, categoryIds: [], basePrice: -1, maxGroupSize: 10001 });
    expect(Object.keys(errors).sort()).toEqual(['basePrice', 'categoryIds', 'durationDays', 'maxGroupSize']);
  });
});
