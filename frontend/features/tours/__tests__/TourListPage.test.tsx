import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn(), tours: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => '/tours',
  useSearchParams: () => mocks.params,
}));
vi.mock('../api/toursApi', () => ({
  useGetToursQuery: (args: unknown) => { mocks.tours(args); return { data: { items: [], meta: { page: 1, limit: 12, total: 0, totalPages: 1 } } }; },
  useGetTourCategoriesQuery: () => ({ data: [{ id: 'beach', name: 'Biển đảo & Nghỉ dưỡng' }] }),
}));
vi.mock('../components/TourCard', () => ({ TourCard: () => null }));
vi.mock('@/components/shared', () => ({
  EmptyState: () => <p>Không có kết quả</p>, ErrorState: () => null, LoadingState: () => null,
}));
vi.mock('@/components/ui', () => ({
  Button: () => null, Pagination: () => null,
  Input: (props: any) => <input {...props} />,
  AntSelect: ({ id, value, onChange, options }: any) => <select id={id} value={value} onChange={event => onChange(event.target.value)}>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
  AntDateRangePicker: () => null,
}));
import { TourListPage } from '../components/TourListPage';

beforeEach(() => { vi.clearAllMocks(); mocks.params = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Tour filters', () => {
  it('places categories inside the filter and hides reset without conditions', () => {
    render(<TourListPage />);
    expect(within(document.querySelector('aside')!).getByLabelText('Danh mục tour')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xóa tất cả' })).toBeNull();
    expect(screen.queryByLabelText(/bộ lọc đang áp dụng/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Danh mục tour'), { target: { value: 'beach' } });
    expect(mocks.replace).toHaveBeenCalledWith('/tours?categoryId=beach', { scroll: false });
  });
  it.each([
    ['departureFrom=2026-11-01&departureTo=2026-11-05', 1],
    ['minPrice=100000&maxPrice=2000000', 1],
    ['minDays=2&maxDays=3', 1],
    ['categoryId=beach', 1],
    ['q=Da+Nang&categoryId=beach&minRating=4&departureFrom=2026-11-01', 4],
  ])('counts filter groups for %s', (query, count) => {
    mocks.params = new URLSearchParams(query);
    render(<TourListPage />);
    expect(screen.getByLabelText(`${count} bộ lọc đang áp dụng`).textContent).toBe(String(count));
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tất cả' }));
    expect(mocks.replace).toHaveBeenCalledWith('/tours', { scroll: false });
  });
  it('does not count pagination, sorting or default filter values', () => {
    mocks.params = new URLSearchParams('page=2&sort=price_asc&minPrice=0&maxPrice=20000000&minRating=0&guests=0');
    render(<TourListPage />);
    expect(screen.queryByRole('button', { name: 'Xóa tất cả' })).toBeNull();
  });
  it('cancels an outstanding price update when clearing filters', () => {
    vi.useFakeTimers();
    mocks.params = new URLSearchParams('categoryId=beach');
    render(<TourListPage />);
    fireEvent.change(screen.getByLabelText('Giá thấp nhất'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tất cả' }));
    vi.advanceTimersByTime(500);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenLastCalledWith('/tours', { scroll: false });
  });
});
