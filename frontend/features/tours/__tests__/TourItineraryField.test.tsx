import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourItineraryField } from '../components/TourItineraryField';
import type { TourItineraryDay } from '../types';
import styles from '../components/tour-itinerary.module.css';

afterEach(cleanup);
const program: TourItineraryDay[] = [{ day: 1, title: 'Đón khách – Khám phá phố cổ', description: 'Tham quan phố cổ và thưởng thức đặc sản địa phương.', activities: ['Đi bộ tham quan', 'Ăn trưa'] }, { day: 2, title: 'Thăm làng nghề – Trở về', description: 'Tìm hiểu nghề thủ công truyền thống.', activities: [] }];
function Harness({ initial = [], duration = 2, apply = vi.fn(), submit = vi.fn() }: { initial?: TourItineraryDay[]; duration?: number; apply?: (value: TourItineraryDay[]) => void; submit?: () => void }) {
  const [value, setValue] = useState(initial);
  return <form onSubmit={e => { e.preventDefault(); submit(); }}><TourItineraryField value={value} duration={duration} onChange={next => { setValue(next); apply(next); }} /></form>;
}
const open = () => { fireEvent.click(screen.getByRole('button', { name: 'Soạn lịch trình' })); return within(screen.getByRole('dialog')); };

async function exportVisual() {
  if (!process.env.ITINERARY_VISUAL_OUTPUT) return;
  const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const directory = resolve(process.env.ITINERARY_VISUAL_OUTPUT);
  mkdirSync(directory, { recursive: true });
  const css = readFileSync('features/tours/components/tour-itinerary.module.css', 'utf8').replace(/\.([a-zA-Z_][\w-]*)/g, (s, key: string) => styles[key] ? `.${styles[key]}` : s);
  writeFileSync(resolve(directory, 'app.css'), readFileSync('.next/static/css/app/layout.css'));
  writeFileSync(resolve(directory, 'popup.html'), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Soạn lịch trình tour</title><link rel="stylesheet" href="app.css"><style>${css}body{background:#f7f8f5;padding:24px}svg{flex-shrink:0}</style></head><body>${document.body.innerHTML}</body></html>`);
}

describe('Tour itinerary popup', () => {
  it('does not leak Enter into the onboarding keyboard handler', () => {
    const outer = vi.fn();
    render(<div onKeyDown={outer}><TourItineraryField value={program} duration={2} onChange={vi.fn()} /></div>);
    const dialog = open();
    fireEvent.keyDown(dialog.getByLabelText('Nội dung chi tiết'), { key: 'Enter' });
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog.getByLabelText('Tiêu đề ngày'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('keeps the onboarding compact and edits only the selected day', async () => {
    render(<Harness initial={program} />);
    expect(screen.getByText('2/2 ngày đã có chương trình')).toBeTruthy();
    expect(screen.queryByLabelText('Tiêu đề ngày')).toBeNull();
    const dialog = open();
    expect(dialog.getAllByLabelText('Tiêu đề ngày')).toHaveLength(1);
    expect((dialog.getByLabelText('Danh sách hoạt động') as HTMLTextAreaElement).value).toContain('Đi bộ tham quan');
    await exportVisual();
    fireEvent.click(dialog.getByRole('button', { name: /Ngày 2/ }));
    expect((dialog.getByLabelText('Tiêu đề ngày') as HTMLInputElement).value).toBe(program[1].title);
  });
  it('applies a valid partial draft without submitting the outer form', () => {
    const apply = vi.fn(), submit = vi.fn();
    render(<Harness apply={apply} submit={submit} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Thêm ngày đầu tiên' }));
    fireEvent.change(dialog.getByLabelText('Tiêu đề ngày'), { target: { value: '  Ngày đầu  ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng lịch trình' }));
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ day: 1, title: 'Ngày đầu', activities: [] })]);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('1/2 ngày đã có chương trình')).toBeTruthy();
  });
  it('allows grouping the full tour without generating a form per day', () => {
    const apply = vi.fn();
    render(<Harness duration={365} apply={apply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Thêm ngày đầu tiên' }));
    fireEvent.change(dialog.getByLabelText('Tiêu đề ngày'), { target: { value: 'Chương trình trọn chuyến' } });
    fireEvent.change(dialog.getByLabelText('Đến ngày (nếu gộp)'), { target: { value: '365' } });
    expect(dialog.getAllByLabelText('Tiêu đề ngày')).toHaveLength(1);
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng lịch trình' }));
    expect(apply.mock.calls[0][0][0].toDay).toBe(365);
  });
  it('rejects overlapping days and retains the draft', () => {
    const apply = vi.fn();
    render(<Harness initial={program} apply={apply} />);
    const dialog = open();
    fireEvent.change(dialog.getByLabelText('Đến ngày (nếu gộp)'), { target: { value: '2' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng lịch trình' }));
    expect(dialog.getByRole('alert').textContent).toContain('trùng');
    expect(apply).not.toHaveBeenCalled();
    expect((dialog.getByLabelText('Tiêu đề ngày') as HTMLInputElement).value).toBe(program[1].title);
  });
  it('discards edits and deletions on cancel, preserving the original data', () => {
    const apply = vi.fn();
    render(<Harness initial={program} apply={apply} />);
    let dialog = open();
    fireEvent.change(dialog.getByLabelText('Tiêu đề ngày'), { target: { value: 'Changed' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Xóa ngày' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Hủy' }));
    expect(apply).not.toHaveBeenCalled();
    dialog = open();
    expect((dialog.getByLabelText('Tiêu đề ngày') as HTMLInputElement).value).toBe(program[0].title);
  });
  it('can remove every day and apply an empty draft', () => {
    const apply = vi.fn();
    render(<Harness initial={[program[0]]} apply={apply} />);
    const dialog = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Xóa ngày' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng lịch trình' }));
    expect(apply).toHaveBeenCalledWith([]);
  });
  it('restores focus/scroll on Escape and traps keyboard focus while open', () => {
    render(<Harness />);
    const dialog = open();
    const first = dialog.getByRole('button', { name: 'Đóng hộp thoại' }), last = dialog.getByRole('button', { name: 'Áp dụng lịch trình' });
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' }); expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Soạn lịch trình' }));
  });
  it('keeps adding activities on separate lines and preserves them on apply', () => {
    const apply = vi.fn(); render(<Harness initial={program} apply={apply} />);
    const dialog = open();
    fireEvent.change(dialog.getByLabelText('Danh sách hoạt động'), { target: { value: 'Đi bộ\nĂn tối\n' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Áp dụng lịch trình' }));
    expect(apply.mock.calls[0][0][0].activities).toEqual(['Đi bộ', 'Ăn tối']);
  });
});
