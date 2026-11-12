import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TourContentFields } from '../components/TourContentFields';
import type { TourContentInput } from '../types';

vi.mock('../components/TourPolicyFields', () => ({ TourPolicyFields: () => null }));
afterEach(cleanup);

it('shows age prices in the import form and preserves edits and cleared prices', () => {
  function Form() {
    const [value, setValue] = useState<TourContentInput>({ title: '', destination: '', durationDays: 1, basePrice: 1000000, categoryIds: [] });
    return <><TourContentFields value={value} onChange={setValue} categories={[]} /><output data-testid="draft">{JSON.stringify(value)}</output></>;
  }
  render(<Form />);
  expect(screen.getByLabelText('Giá người lớn · từ 13 tuổi trở lên (VND)')).toBeTruthy();
  const child = screen.getByLabelText('Giá Trẻ em (2 - 12 tuổi)');
  const infant = screen.getByLabelText('Giá Em bé (dưới 2 tuổi)');
  fireEvent.change(child, { target: { value: '500000' } });
  fireEvent.change(infant, { target: { value: '0' } });
  expect(JSON.parse(screen.getByTestId('draft').textContent!).agePricing).toMatchObject({ childPrice: 500000, infantPrice: 0, adultMinAge: 13 });
  const childInput = screen.getByLabelText('Giá Trẻ em (2 - 12 tuổi)');
  fireEvent.change(childInput, { target: { value: '' } });
  expect(JSON.parse(screen.getByTestId('draft').textContent!).agePricing).toMatchObject({ childPrice: null, infantPrice: 0 });
});
