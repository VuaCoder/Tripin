import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgencyCommissionSettings } from '../components/AgencyCommissionSettings';

const mocks = vi.hoisted(() => ({ create: vi.fn(), cancel: vi.fn() }));

vi.mock('../AgencyCommon', () => ({ useAgencyPermission: () => true }));
vi.mock('../commissionApi', () => ({
  useGetAgencyCommissionQuery: () => ({
    data: {
      effectiveShareBps: 9000, effectiveSharePercent: 90, pendingRequest: null, recentRequests: [],
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useCreateAgencyCommissionRequestMutation: () => [mocks.create, { isLoading: false }],
  useCancelAgencyCommissionRequestMutation: () => [mocks.cancel, { isLoading: false }],
}));

afterEach(cleanup);

describe('AgencyCommissionSettings request modal', () => {
  it('opens clamped at 50, follows the wheel, and enforces a 10-character reason', () => {
    render(<AgencyCommissionSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu điều chỉnh' }));

    const input = document.getElementById('desired-discount') as HTMLInputElement;
    expect(input.value).toBe('50'); // 90% hiện tại vượt trần 50%

    const wheel = screen.getByRole('listbox', { name: 'Chọn mức chiết khấu' });
    wheel.scrollTop = 20 * 36;
    fireEvent.scroll(wheel);
    expect(input.value).toBe('20');

    fireEvent.change(document.getElementById('request-reason')!, { target: { value: 'ngan' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Lý do điều chỉnh cần tối thiểu 10 ký tự.');
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
