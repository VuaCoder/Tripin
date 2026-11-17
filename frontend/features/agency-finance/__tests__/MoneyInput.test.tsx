import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatVndDigits, MoneyInput } from '../FinanceUi';
import { AgencyWallet } from '../WalletUi';

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  walletData: {
    pending: '0',
    available: '7200000',
    reserved: '0',
    frozen: '0',
    total: '7200000',
    bankVerified: true,
    policy: {
      minWithdrawal: '100000',
      maxWithdrawal: '500000000',
      processingHours: 48,
    },
  },
}));

vi.mock('antd', async () => ({
  ...await vi.importActual<typeof import('antd')>('antd'),
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

vi.mock('../walletApi', () => ({
  useWalletQuery: () => ({ currentData: mocks.walletData, isError: false, refetch: vi.fn() }),
  useWalletActionMutation: () => [mocks.action, { isLoading: false }],
  useSettlementsQuery: () => ({ currentData: { items: [], total: 0 }, refetch: vi.fn() }),
  useWithdrawalsQuery: () => ({ currentData: { items: [], total: 0 }, refetch: vi.fn() }),
}));

vi.mock('../financeApi', () => ({
  useFinanceUploadMutation: () => [vi.fn(), { isLoading: false }],
  useFinanceAdminBankMutation: () => [vi.fn(), { isLoading: false }],
  useFinanceDownloadMutation: () => [vi.fn(), { isLoading: false }],
}));

afterEach(cleanup);

describe('MoneyInput and formatVndDigits', () => {
  it('correctly formats digits with dot thousand separators', () => {
    expect(formatVndDigits('')).toBe('');
    expect(formatVndDigits('0')).toBe('0');
    expect(formatVndDigits('7')).toBe('7');
    expect(formatVndDigits('72')).toBe('72');
    expect(formatVndDigits('720')).toBe('720');
    expect(formatVndDigits('7200')).toBe('7.200');
    expect(formatVndDigits('72000')).toBe('72.000');
    expect(formatVndDigits('720000')).toBe('720.000');
    expect(formatVndDigits('7200000')).toBe('7.200.000');
    expect(formatVndDigits('500000000')).toBe('500.000.000');
  });

  it('formats input while typing and preserves digit order', () => {
    render(<MoneyInput name="testAmount" aria-label="Số tiền" />);
    const input = screen.getByRole('textbox', { name: 'Số tiền' }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '720000' } });
    expect(input.value).toBe('720.000');

    fireEvent.change(input, { target: { value: '7200000' } });
    expect(input.value).toBe('7.200.000');
  });

  it('handles defaultValue correctly', () => {
    render(<MoneyInput name="testAmount" aria-label="Số tiền" defaultValue="7200000" />);
    const input = screen.getByRole('textbox', { name: 'Số tiền' }) as HTMLInputElement;
    expect(input.value).toBe('7.200.000');
  });

  it('submits clean unformatted digit string in AgencyWallet withdrawal request', async () => {
    mocks.action.mockReset().mockReturnValue({ unwrap: async () => ({ data: { id: 'req-1' } }) });
    render(<AgencyWallet agencyId="agency-1" canWithdraw={true} onBank={vi.fn()} />);

    // Open withdrawal modal
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu rút tiền' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Type 720000
    fireEvent.change(input, { target: { value: '720000' } });
    expect(input.value).toBe('720.000');

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận yêu cầu rút' }));

    await waitFor(() => {
      expect(mocks.action).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/agency/finance/withdrawals',
          body: expect.objectContaining({
            amount: '720000',
          }),
        })
      );
    });
  });

  it('validates minimum and maximum withdrawal boundaries', async () => {
    mocks.action.mockReset();
    render(<AgencyWallet agencyId="agency-1" canWithdraw={true} onBank={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu rút tiền' }));
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Below minWithdrawal (100.000 đ)
    fireEvent.change(input, { target: { value: '50000' } });
    expect(input.value).toBe('50.000');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận yêu cầu rút' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/tối thiểu là 100\.000 đ/);
    expect(mocks.action).not.toHaveBeenCalled();

    // Above available (7.200.000 đ)
    fireEvent.change(input, { target: { value: '8000000' } });
    expect(input.value).toBe('8.000.000');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận yêu cầu rút' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/không được vượt quá 7\.200\.000 đ/);
    expect(mocks.action).not.toHaveBeenCalled();
  });
});
