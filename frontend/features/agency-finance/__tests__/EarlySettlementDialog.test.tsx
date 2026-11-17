import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn(), close: vi.fn(), success: vi.fn() }));
vi.mock('../walletApi', () => ({ useWalletActionMutation: () => [mocks.run, {}] }));
vi.mock('antd', () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div> }));
import EarlySettlementDialog from '../EarlySettlementDialog';
beforeEach(() => {
  mocks.run.mockReset().mockImplementation(() => ({ unwrap: async () => ({ data: { settled: 2, skipped: 1, failed: 0, alreadySettled: 0, totalAmount: '18000000' } }) }));
  mocks.close.mockClear(); mocks.success.mockClear();
});
afterEach(cleanup);
describe('Admin early settlement', () => {
  it('shows Vietnamese field errors without sending empty or too-short reasons', () => {
    render(<EarlySettlementDialog agencyId="agency-1" onClose={mocks.close} onSuccess={mocks.success} />);
    const input = screen.getByLabelText('Lý do quyết toán sớm');
    const form = screen.getByRole('button', { name: 'Xác nhận quyết toán' }).closest('form')!;
    expect(form.noValidate).toBe(true);
    fireEvent.submit(form);
    expect(screen.getByRole('alert').textContent).toBe('Vui lòng nhập lý do quyết toán sớm.');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(form);
    expect(screen.getByRole('alert').textContent).toBe('Lý do cần ít nhất 3 ký tự.');
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('runs only after confirmation and submits the reason against the entire Agency', async () => {
    render(<EarlySettlementDialog agencyId="agency-1" onClose={mocks.close} onSuccess={mocks.success} />);
    expect(mocks.run).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Lý do quyết toán sớm'), { target: { value: 'Đã kiểm tra hồ sơ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận quyết toán' }).closest('form')!);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce());
    expect(mocks.run).toHaveBeenCalledWith({ url: '/admin/finance/settlements/agency-1/release-all', body: { note: 'Đã kiểm tra hồ sơ' }, timeout: 60000 });
    expect(mocks.success).toHaveBeenCalledWith({ settled: 2, skipped: 1, failed: 0, alreadySettled: 0, totalAmount: '18000000' });
  });
  it('shows a clear result in the popup when every booking is blocked', async () => {
    mocks.run.mockImplementation(() => ({ unwrap: async () => ({ data: { settled: 0, skipped: 5, failed: 0, alreadySettled: 0, totalAmount: '0' } }) }));
    render(<EarlySettlementDialog agencyId="agency-1" onClose={mocks.close} onSuccess={mocks.success} />);
    fireEvent.change(screen.getByLabelText('Lý do quyết toán sớm'), { target: { value: 'Đã kiểm tra hồ sơ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận quyết toán' }).closest('form')!);
    expect(await screen.findByText(/Không có khoản đủ điều kiện quyết toán/)).toBeTruthy();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('keeps the dialog open and shows an error when the batch request fails', async () => {
    mocks.run.mockImplementation(() => ({ unwrap: async () => { throw { data: { message: 'Không thực hiện được quyết toán' } }; } }));
    render(<EarlySettlementDialog agencyId="agency-1" onClose={mocks.close} onSuccess={mocks.success} />);
    fireEvent.change(screen.getByLabelText('Lý do quyết toán sớm'), { target: { value: 'Đã kiểm tra hồ sơ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận quyết toán' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Không thực hiện được quyết toán');
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.close).not.toHaveBeenCalled();
  });
});
