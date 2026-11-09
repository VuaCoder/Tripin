import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/features/auth/types';
vi.mock('@/features/premium/PremiumIdentity', () => ({ OwnPremiumIdentity: () => null, OwnPremiumStatus: () => null }));
import { ProfileSummary } from '../components/ProfileSummary';
afterEach(cleanup);

it('offers an accessible icon edit action and removes duplicate voucher and security content', () => {
  const user: UserProfile = { id: 'qa', email: 'qa@example.com', fullName: 'Traveler QA', role: 'TRAVELER', status: 'ACTIVE', permissions: [], extraPermissions: [], twoFactorEnabled: false, createdAt: '2026-01-01' };
  const edit = vi.fn();
  render(<ProfileSummary user={user} onEdit={edit} />);
  const button = screen.getByRole('button', { name: 'Chỉnh sửa thông tin cá nhân' });
  expect(button.textContent?.trim()).toBe('edit');
  fireEvent.click(button);
  expect(edit).toHaveBeenCalledOnce();
  expect(screen.queryByText('Ví voucher & Ưu đãi')).toBeNull();
  expect(screen.queryByText('Xác thực hai lớp')).toBeNull();
});
