import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../Input';

describe('Input component', () => {
  it('prevents typing e, E, +, - when type is number', () => {
    render(<Input data-testid="num-input" type="number" />);
    const input = screen.getByTestId('num-input');

    const eEvent = fireEvent.keyDown(input, { key: 'e' });
    expect(eEvent).toBe(false);

    const capEEvent = fireEvent.keyDown(input, { key: 'E' });
    expect(capEEvent).toBe(false);

    const plusEvent = fireEvent.keyDown(input, { key: '+' });
    expect(plusEvent).toBe(false);

    const minusEvent = fireEvent.keyDown(input, { key: '-' });
    expect(minusEvent).toBe(false);

    const digitEvent = fireEvent.keyDown(input, { key: '5' });
    expect(digitEvent).toBe(true);
  });

  it('prevents typing e, E, +, - when inputMode is numeric', () => {
    render(<Input data-testid="mode-input" inputMode="numeric" />);
    const input = screen.getByTestId('mode-input');

    const eEvent = fireEvent.keyDown(input, { key: 'e' });
    expect(eEvent).toBe(false);
  });

  it('allows normal typing for text input', () => {
    render(<Input data-testid="text-input" type="text" />);
    const input = screen.getByTestId('text-input');

    const eEvent = fireEvent.keyDown(input, { key: 'e' });
    expect(eEvent).toBe(true);
  });
});
