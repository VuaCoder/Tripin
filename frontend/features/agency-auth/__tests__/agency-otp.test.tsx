import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), dispatch: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../api', () => ({ agencyAuthApi: { verifyOtp: mocks.verifyOtp }, AgencyApiError: class extends Error {} }));
import { AgencyOtpPage } from '../AgencyOtpPage';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('agency OTP login session', () => {
  it.each(['VERIFIED', 'PENDING'])('restores credentials before routing a %s agency', async (verificationStatus) => {
    const user = { id: 'agency', role: 'AGENCY', agencyProfile: { verificationStatus } };
    mocks.verifyOtp.mockResolvedValue({ accessToken: 'access', user });
    render(<AgencyOtpPage email="agency@example.com" purpose="LOGIN_2FA" />);
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input, index) => fireEvent.change(input, { target: { value: String(index + 1) } }));
    fireEvent.submit(inputs[0].closest('form')!);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(verificationStatus === 'VERIFIED' ? '/agency' : '/application-status'));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: { accessToken: 'access', user } }));
  });
});
