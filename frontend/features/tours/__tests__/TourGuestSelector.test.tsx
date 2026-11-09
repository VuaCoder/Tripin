import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourGuestSelector } from '../components/detail/TourGuestSelector';
vi.mock('@/features/review', () => ({ formatVnd: (n: number) => `${n} đ` }));
afterEach(cleanup);
describe('age guest selection', () => {
  it('hides unavailable children but keeps free infants and accepts typed quantities', () => {
    const onChange = vi.fn();
    render(<TourGuestSelector value={{ adults: 1, children: 0, infants: 0 }} max={5} unitPrice={1000000} pricing={{ childMinAge: 2, adultMinAge: 13, childPercent: 100, infantPercent: 100, childPrice: null, infantPrice: 0 }} onChange={onChange} />);
    expect(screen.queryByLabelText('Trẻ em')).toBeNull();
    expect(screen.getByText('Từ 13 tuổi trở lên')).toBeTruthy();
    const input = screen.getByLabelText('Em bé');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({ adults: 1, children: 0, infants: 4 });
    const adult = screen.getByLabelText('Người lớn');
    fireEvent.change(adult, { target: { value: '' } });
    expect((adult as HTMLInputElement).value).toBe('');
    fireEvent.change(adult, { target: { value: '3' } });
    fireEvent.keyDown(adult, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ adults: 3, children: 0, infants: 0 });
  });
});
