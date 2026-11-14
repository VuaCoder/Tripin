import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourExtra } from '@travel-platform/constants';
import { TourServicesField } from '../components/TourServicesField';
import styles from '../components/tour-services.module.css';

afterEach(cleanup);
const service: TourExtra = { id: '11111111-1111-4111-8111-111111111111', name: 'Ăn sáng bổ sung', description: '', kind: 'MEAL', pricing: 'PER_PERSON',
  unit: 'người', price: 50000, active: true, cutoffHours: 24, maxQuantity: 50, ages: ['ADULT', 'CHILD', 'INFANT'] };

function Harness({ initial = [], onApply = vi.fn(), onSubmit = vi.fn() }: { initial?: TourExtra[]; onApply?: (value: TourExtra[]) => void; onSubmit?: () => void }) {
  const [value, setValue] = useState(initial);
  return <form onSubmit={event => { event.preventDefault(); onSubmit(); }}><TourServicesField value={value} onChange={next => { setValue(next); onApply(next); }} /></form>;
}
const open = () => { fireEvent.click(screen.getByRole('button', { name: 'Quản lý dịch vụ' })); return within(screen.getByRole('dialog')); };

async function exportVisual(name: string) {
  if (!process.env.SERVICES_VISUAL_OUTPUT) return;
  const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const directory = resolve(process.env.SERVICES_VISUAL_OUTPUT);
  mkdirSync(directory, { recursive: true });
  const css = readFileSync('features/tours/components/tour-services.module.css', 'utf8')
    .replace(/\.([a-zA-Z_][\w-]*)/g, (selector, key: string) => styles[key] ? `.${styles[key]}` : selector);
  writeFileSync(resolve(directory, 'app.css'), readFileSync('.next/static/css/app/layout.css'));
  writeFileSync(resolve(directory, `${name}.html`), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dịch vụ tour — kiểm tra giao diện</title><link rel="stylesheet" href="app.css"><style>${css}body{background:#f7f8f5;padding:24px}body>div:first-child{max-width:960px;margin:auto}svg{flex-shrink:0}</style></head><body>${document.body.innerHTML}</body></html>`);
}

describe('TourServicesField', () => {
  it('requires an explicit price for quick suggestions instead of assuming free service', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Ăn sáng bổ sung' }));
    expect((dialog.getByLabelText(/^Giá \/ người/) as HTMLInputElement).value).toBe('');
    expect((dialog.getByLabelText('Mô tả (không bắt buộc)') as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText(/^Giá \/ người/), { target: { value: '0' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).toHaveBeenCalledWith([expect.objectContaining({ price: 0, description: '' })]);
  });

  it('uses simple per-person defaults without exposing technical configuration', () => {
    const onApply = vi.fn();
    render(<Harness initial={[{ ...service, pricing: 'PER_BOOKING', unit: 'gói', active: false, maxQuantity: 2, ages: ['ADULT'] }]} onApply={onApply} />);
    const dialog = open();
    for (const label of ['Loại dịch vụ', 'Cách tính', 'Đơn vị', 'Tối đa mỗi booking', 'Mở bán dịch vụ']) {
      expect(dialog.queryByLabelText(label)).toBeNull();
    }
    expect(dialog.queryByText('Nhóm khách áp dụng')).toBeNull();
    expect(dialog.queryByText('Giá tính theo từng người được khách chọn sử dụng dịch vụ.')).toBeNull();
    expect(dialog.getByLabelText('Mô tả (không bắt buộc)')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).toHaveBeenCalledWith([expect.objectContaining({ pricing: 'PER_PERSON', unit: 'người', active: true, maxQuantity: 100, ages: ['ADULT', 'CHILD', 'INFANT'] })]);
  });

  it('keeps the tour form compact until the manager is opened', async () => {
    render(<Harness />);
    expect(screen.getByText('0/20')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('Tên dịch vụ')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo dịch vụ khác' })).toBeNull();
    await exportVisual('empty-summary');
    expect(open().getByRole('button', { name: 'Đưa đón tận nơi' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    await exportVisual('empty-popup');
  });

  it('applies a valid draft once without submitting the outer tour form', async () => {
    const onApply = vi.fn(), onSubmit = vi.fn();
    render(<Harness onApply={onApply} onSubmit={onSubmit} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Ăn sáng bổ sung' }));
    fireEvent.change(dialog.getByLabelText(/^Giá \/ người \(VND\)/), { target: { value: '75000' } });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject([{ name: 'Ăn sáng bổ sung', price: 75000 }]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ăn sáng bổ sung')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quản lý dịch vụ' }));
    await exportVisual('saved-summary');
  });

  it('discards edits and removals on cancel and restores the last applied services on reopen', () => {
    const onApply = vi.fn();
    render(<Harness initial={[service]} onApply={onApply} />);
    let dialog = open();
    fireEvent.change(dialog.getByLabelText('Tên dịch vụ'), { target: { value: 'Changed' } });
    fireEvent.click(dialog.getByRole('button', { name: /^Xóa dịch vụ/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Hủy' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(service.name).toBe('Ăn sáng bổ sung');
    dialog = open();
    expect((dialog.getByLabelText('Tên dịch vụ') as HTMLInputElement).value).toBe(service.name);
  });

  it('keeps invalid pickup configuration inside the dialog instead of applying it', async () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Đưa đón tận nơi' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(dialog.getByRole('alert').textContent).toContain('Đưa đón tận nơi');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText('Khu vực phục vụ'), { target: { value: 'Hoàn Kiếm' } });
    fireEvent.change(dialog.getByLabelText(/^Giá \/ người/), { target: { value: '0' } });
    await exportVisual('pickup-popup');
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply.mock.calls[0][0][0].pickup.area).toBe('Hoàn Kiếm');
  });

  it('supports removing every service and applying an empty list', () => {
    const onApply = vi.fn();
    render(<Harness initial={[service]} onApply={onApply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: /^Xóa dịch vụ/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).toHaveBeenCalledWith([]);
    expect(screen.getByText('0/20')).toBeTruthy();
  });

  it('discards the draft on Escape and restores focus and background scrolling', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Ăn sáng bổ sung' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quản lý dịch vụ' }));
  });

  it('keeps Tab and Shift+Tab within the dialog', () => {
    render(<Harness />);
    const dialog = open();
    const first = dialog.getByRole('button', { name: 'Đóng hộp thoại' });
    const last = dialog.getByRole('button', { name: 'Áp dụng dịch vụ' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('does not open the editor for staff with read-only tour access', () => {
    render(<TourServicesField value={[service]} onChange={vi.fn()} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Quản lý dịch vụ' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prevents adding the same preset multiple times and disables the button once added', () => {
    render(<Harness />);
    const dialog = open();
    const breakfastBtn = dialog.getByRole('button', { name: 'Ăn sáng bổ sung' }) as HTMLButtonElement;
    expect(breakfastBtn.disabled).toBe(false);

    // Click once
    fireEvent.click(breakfastBtn);
    expect(dialog.getAllByLabelText('Tên dịch vụ')).toHaveLength(1);
    expect(breakfastBtn.disabled).toBe(true);

    // Attempt to click again should not add a second instance
    fireEvent.click(breakfastBtn);
    expect(dialog.getAllByLabelText('Tên dịch vụ')).toHaveLength(1);
  });

  it('supports expanding catalog, searching services, and adding items without duplication', () => {
    render(<Harness />);
    const dialog = open();

    // Expand catalog
    const toggleBtn = dialog.getByRole('button', { name: 'Xem thêm gợi ý dịch vụ' });
    fireEvent.click(toggleBtn);
    expect(dialog.getByRole('button', { name: 'Ẩn gợi ý dịch vụ' })).toBeTruthy();

    // Search for a specific service e.g. "hải sản"
    const searchInput = dialog.getByPlaceholderText(/Tìm kiếm dịch vụ/);
    fireEvent.change(searchInput, { target: { value: 'hải sản' } });
    expect(dialog.getByText('Bữa tối hải sản / BBQ đặc sản')).toBeTruthy();

    // Add service from catalog
    const addBtn = dialog.getByRole('button', { name: 'Thêm dịch vụ Bữa tối hải sản / BBQ đặc sản' }) as HTMLButtonElement;
    fireEvent.click(addBtn);
    expect(addBtn.disabled).toBe(true);
    expect(addBtn.textContent).toContain('Đã thêm');

    // Verify it is added to the list
    expect(dialog.getAllByLabelText('Tên dịch vụ')).toHaveLength(1);
    expect((dialog.getByLabelText('Tên dịch vụ') as HTMLInputElement).value).toBe('Bữa tối hải sản / BBQ đặc sản');
    expect((dialog.getByLabelText(/^Giá \/ người/) as HTMLInputElement).value).toBe('');
    expect((dialog.getByLabelText('Mô tả (không bắt buộc)') as HTMLTextAreaElement).value).toBe('');
    expect(dialog.queryByText(/250.000 đ/)).toBeNull();
    expect(dialog.queryByText(/21 mẫu/)).toBeNull();
  });

  it('rejects applying duplicate service names when user inputs duplicate names manually', () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    const dialog = open();

    // Add one service
    fireEvent.click(dialog.getByRole('button', { name: 'Ăn sáng bổ sung' }));

    // Add custom service and name it the same
    fireEvent.click(dialog.getByRole('button', { name: 'Tạo dịch vụ khác' }));
    const nameInputs = dialog.getAllByLabelText('Tên dịch vụ');
    expect(nameInputs).toHaveLength(2);
    fireEvent.change(nameInputs[1], { target: { value: 'Ăn sáng bổ sung' } });

    // Try applying
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng dịch vụ' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(dialog.getByRole('alert').textContent).toContain('bị trùng lặp');
  });
});
