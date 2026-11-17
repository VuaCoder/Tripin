import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  permissions: ['agency:finance-view', 'agency:finance-bank-manage'],
  bank: null as null | { bankName: string; accountHolder: string; last4: string; version: number },
  save: vi.fn(),
}));
vi.mock('@/features/agency/agencyContext', () => ({ useAgencyContext: () => ({ agencyId: 'agency-a', permissions: mocks.permissions }) }));
vi.mock('../financeApi', () => ({
  useFinanceBankQuery: () => ({ currentData: mocks.bank, refetch: vi.fn() }),
  useSaveFinanceBankMutation: () => [mocks.save, {}],
}));
import AgencyBankSettings from '../AgencyBankSettings';
beforeEach(() => {
  mocks.permissions = ['agency:finance-view', 'agency:finance-bank-manage'];
  mocks.bank = null;
  mocks.save.mockReset().mockImplementation(() => ({ unwrap: async () => ({ data: { saved: true } }) }));
});
afterEach(cleanup);
describe('Agency receiving account settings', () => {
  it('keeps only digits when typing or pasting an account number, preserving leading zeroes', () => {
    render(<AgencyBankSettings />);
    const input = screen.getByLabelText('Số tài khoản') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'a' } });
    expect(input.value).toBe('');
    fireEvent.input(input, { target: { value: '0012 ab-34.56\n' } });
    expect(input.value).toBe('00123456');
  });
  it('saves the three account fields with the current record version', async () => {
    render(<AgencyBankSettings />);
    fireEvent.change(screen.getByLabelText('Ngân hàng'), { target: { value: 'Vietcombank' } });
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByLabelText('Tên chủ tài khoản'), { target: { value: 'AGENCY A' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu tài khoản' }).closest('form')!);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ bankName: 'Vietcombank', accountNumber: '1234567890', accountHolder: 'AGENCY A', expectedVersion: 0 }));
    expect(await screen.findByText('Đã lưu tài khoản nhận tiền.')).toBeTruthy();
  });
  it('requires the new account number and uses the saved version when editing', async () => {
    mocks.bank = { bankName: 'Bank A', accountHolder: 'AGENCY A', last4: '7890', version: 3 };
    render(<AgencyBankSettings />);
    expect(screen.getByText('•••• 7890')).toBeTruthy();
    expect((screen.getByLabelText('Số tài khoản') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Số tài khoản'), { target: { value: '9876543210' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu tài khoản' }).closest('form')!);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 3, accountNumber: '9876543210' })));
  });
  it('does not offer edits to a member with view access only', () => {
    mocks.permissions = ['agency:finance-view'];
    render(<AgencyBankSettings />);
    expect((screen.getByRole('button', { name: 'Lưu tài khoản' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/chủ Agency hoặc người được cấp quyền/)).toBeTruthy();
  });
});
