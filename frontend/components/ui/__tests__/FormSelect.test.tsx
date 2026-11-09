import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { FormSelect } from '../FormSelect';
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
afterEach(cleanup);
it('updates FormData and the existing change handler', () => {
  const changed = vi.fn();
  const { container } = render(<form><FormSelect aria-label="Status" name="status" defaultValue="" onChange={e => changed(e.target.value)}><option value="">All</option><option value="VALID">Valid</option></FormSelect></form>);
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(screen.getAllByText('Valid').find(el => el.classList.contains('ant-select-item-option-content'))!);
  expect(changed).toHaveBeenCalledWith('VALID');
  expect(new FormData(container.querySelector('form')!).get('status')).toBe('VALID');
});
it('preserves disabled controls', () => {
  render(<FormSelect aria-label="Status" value="A" disabled><option>A</option></FormSelect>);
  expect((screen.getByRole('combobox') as HTMLInputElement).disabled).toBe(true);
});
