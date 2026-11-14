import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TourExtra } from '@travel-platform/constants';
import { AgencyTourServicesSummary } from '../components/AgencyTourServicesSummary';

afterEach(cleanup);
const service: TourExtra = { id: 'meal', name: 'Ăn sáng', description: 'Bữa sáng tại khách sạn', kind: 'MEAL', pricing: 'PER_PERSON', unit: 'người', price: 50000, active: true, cutoffHours: 24, maxQuantity: 100, ages: ['ADULT', 'CHILD', 'INFANT'] };

describe('AgencyTourServicesSummary', () => {
  it('shows saved services separately from base tour price', () => {
    render(<AgencyTourServicesSummary services={[service]} />);
    expect(screen.getByRole('region', { name: 'Dịch vụ bổ sung' })).toBeTruthy();
    expect(screen.getByText('Ăn sáng')).toBeTruthy();
    expect(screen.getByText('50.000 ₫/người')).toBeTruthy();
    expect(screen.getByText(service.description)).toBeTruthy();
    expect(screen.getByText(/ít nhất 24 giờ/)).toBeTruthy();
  });
  it('shows pickup instructions, free service and inactive status', () => {
    render(<AgencyTourServicesSummary services={[{ ...service, id: 'pickup', name: 'Đưa đón', kind: 'PICKUP', price: 0, active: false, cutoffHours: 0, pickup: { mode: 'POINT', area: 'Hà Nội', points: ['Điểm A', 'Điểm B'], instructions: 'Đón một chiều' } }]} />);
    for (const text of ['Miễn phí', 'Ngừng bán', 'Có thể đặt đến giờ khởi hành', 'Đón một chiều']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText(/Điểm A; Điểm B/)).toBeTruthy();
    expect(screen.getByText(/Hà Nội/)).toBeTruthy();
  });
  it('supports tours created before optional services existed', () => {
    render(<AgencyTourServicesSummary />);
    expect(screen.getByText('Chưa có dịch vụ bổ sung.')).toBeTruthy();
  });
  it('retains legacy booking and unit pricing labels', () => {
    render(<AgencyTourServicesSummary services={[{ ...service, pricing: 'PER_BOOKING' }, { ...service, id: 'unit', pricing: 'PER_UNIT', unit: 'bộ' }]} />);
    expect(screen.getByText('50.000 ₫/booking')).toBeTruthy();
    expect(screen.getByText('50.000 ₫/bộ')).toBeTruthy();
  });
});
