import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { VndPriceInput } from '../components/VndPriceInput';

afterEach(cleanup);

it('formats while typing and preserves the digit order', () => {
  function Form() {
    const [price, setPrice] = useState(0);
    return <><VndPriceInput aria-label="Price" value={price} onValueChange={setPrice} /><output>{price}</output></>;
  }
  render(<Form />);
  const input = screen.getByRole('textbox', { name: 'Price' }) as HTMLInputElement;
  fireEvent.focus(input);
  for (const digits of ['1', '15', '150', '1500', '15000', '150000', '1500000']) {
    fireEvent.change(input, { target: { value: digits } });
    expect(input.value.replace(/\D/g, '')).toBe(digits);
  }
  expect(input.value).toBe('1.500.000');
  input.setSelectionRange(2, 2);
  fireEvent.change(input, { target: { value: '19.500.000', selectionStart: 2 } });
  expect(input.value).toBe('19.500.000');
  expect(input.selectionStart).toBe(3);
  expect(screen.getByText('19500000')).toBeTruthy();
  fireEvent.blur(input);
  expect(input.value).toBe('19.500.000');
});

it('waits for Vietnamese IME composition to finish before parsing', () => {
  function Form() {
    const [price, setPrice] = useState(0);
    return <><VndPriceInput aria-label="Price" value={price} onValueChange={setPrice} /><output>{price}</output></>;
  }
  render(<Form />);
  const input = screen.getByRole('textbox', { name: 'Price' }) as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: '1500' } });
  expect(input.value).toBe('1500');
  expect(screen.getByText('0')).toBeTruthy();
  fireEvent.compositionEnd(input);
  expect(screen.getByText('1500')).toBeTruthy();
  expect(input.value).toBe('1.500');
  fireEvent.blur(input);
  expect(input.value).toBe('1.500');
});
