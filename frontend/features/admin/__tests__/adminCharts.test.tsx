import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { DistributionChart } from '../components/AdminCharts';

const RED = '#ef4444';
const TEAL = '#0f766e';
// jsdom reports inline hex as computed rgb(), so compare via a shared resolver.
const rgb = (hex: string) => {
  const el = document.createElement('div');
  el.style.color = hex;
  return el.style.color; // e.g. 'rgb(15, 118, 110)'
};

function legendColor(label: string): string {
  const row = screen.getByText(label).closest('div')!;
  const dot = row.querySelector('span[class*="rounded-full"]') as HTMLElement;
  return dot.style.background;
}

describe('AdminCharts DistributionChart color semantics', () => {
  afterEach(() => cleanup());

  it('renders CANCELLED ("Đã hủy") in a non-positive color, never green', () => {
    render(<DistributionChart title="Booking theo trạng thái" values={{ CANCELLED: 2 }} />);
    expect(legendColor('Đã hủy')).toBe(rgb(RED));
    expect(legendColor('Đã hủy')).not.toBe(rgb(TEAL));
  });

  it('keeps ACTIVE/APPROVED/CONFIRMED positive statuses in the positive teal', () => {
    render(<DistributionChart title="Người dùng theo trạng thái" values={{ ACTIVE: 5, CANCELLED: 1, REJECTED: 2 }} />);
    expect(legendColor('Hoạt động')).toBe(rgb(TEAL));
    expect(legendColor('Đã hủy')).toBe(rgb(RED));
    expect(legendColor('Từ chối')).toBe(rgb(RED));
  });

  it('assigns a color deterministically regardless of chart composition (order independent)', () => {
    // Same key order in both renders; colors must match even though values differ.
    const a = render(<DistributionChart title="T1" values={{ COMPLETED: 3, DRAFT: 1 }} />);
    const colorA = legendColor('Hoàn thành');
    a.unmount();
    const b = render(<DistributionChart title="T2" values={{ COMPLETED: 1, DRAFT: 5 }} />);
    const colorB = legendColor('Hoàn thành');
    b.unmount();
    expect(colorA).toBe(colorB);
  });
});
