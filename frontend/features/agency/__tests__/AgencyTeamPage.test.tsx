import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgencyTeamPage } from '../components/AgencyTeamPage';

const mocks = vi.hoisted(() => ({
  permissions: ['agency:team-view', 'agency:team-invite', 'agency:team-manage'],
  memberRole: 'OWNER' as string | null,
  members: [] as any[],
  refetch: vi.fn(),
  invite: vi.fn(),
  update: vi.fn(),
  inviteResult: {},
  updateResult: {},
}));

vi.mock('@/store/hooks', () => ({
  useAppSelector: () => ({
    memberRole: mocks.memberRole,
    permissions: mocks.permissions,
  }),
}));
vi.mock('@/features/auth/store/authSlice', () => ({
  selectActiveAgency: () => ({
    memberRole: mocks.memberRole,
    permissions: mocks.permissions,
    companyName: 'Test Agency',
  }),
  selectUser: () => ({ id: 'actor-1' }),
}));
vi.mock('@/features/agency/AgencyCommon', async (original) => {
  const mod = await original<typeof import('@/features/agency/AgencyCommon')>();
  return {
    ...mod,
    useAgencyPermission: (permission: string) => mocks.permissions.includes(permission),
  };
});
vi.mock('@/features/agency/agencyTeamApi', () => ({
  useAgencyMembersQuery: () => ({ data: mocks.members, isLoading: false, isError: false, refetch: mocks.refetch }),
  useInviteAgencyMemberMutation: () => [mocks.invite, { isLoading: false, ...mocks.inviteResult }],
  useUpdateAgencyMemberMutation: () => [mocks.update, { isLoading: false, ...mocks.updateResult }],
}));
vi.mock('@/features/agency/agencyNotice', () => ({
  agencyNotice: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('antd', () => ({ notification: { success: vi.fn(), error: vi.fn() } }));

const member = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  userId: 'u-1',
  role: 'STAFF',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  user: { fullName: 'Nguyễn Văn A', email: 'a@example.com', avatarUrl: undefined },
  ...overrides,
});

beforeEach(() => {
  mocks.permissions = ['agency:team-view', 'agency:team-invite', 'agency:team-manage'];
  mocks.memberRole = 'OWNER';
  mocks.members = [member()];
  vi.clearAllMocks();
  mocks.invite.mockReturnValue({ unwrap: () => Promise.resolve({ id: 'inv-1' }) });
  mocks.update.mockReturnValue({ unwrap: () => Promise.resolve(member()) });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('AgencyTeamPage', () => {
  it('renders member rows with role badge, status and joined date in vi-VN', () => {
    render(<AgencyTeamPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeDefined();
    expect(screen.getByText('a@example.com')).toBeDefined();
    expect(screen.getAllByText('Nhân viên').length).toBeGreaterThan(0);
    expect(screen.getByText('Hoạt động')).toBeDefined();
    expect(screen.getByText(/10\/(2026|10)|0?1\/10\/2026/)).toBeDefined();
  });

  it('shows Auth: no Manage column when team-manage is missing', () => {
    mocks.permissions = ['agency:team-view'];
    render(<AgencyTeamPage />);
    expect(screen.queryByText('Quản lý')).toBeNull();
  });

  it('hides invite control when team-invite is missing', () => {
    mocks.permissions = ['agency:team-view', 'agency:team-manage'];
    render(<AgencyTeamPage />);
    expect(screen.queryByRole('button', { name: '+ Mời thành viên' })).toBeNull();
  });

  it('lets an OWNER invite a MANAGER and shows a success notice', async () => {
    mocks.memberRole = 'OWNER';
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Mời thành viên' }));
    const role = screen.getByLabelText('Vai trò:') as HTMLSelectElement;
    expect(role.querySelectorAll('option').length).toBe(3);
    fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'b@example.com' } });
    fireEvent.change(role, { target: { value: 'MANAGER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    await screen.findByRole('status');
    expect(mocks.invite).toHaveBeenCalledWith({ email: 'b@example.com', role: 'MANAGER' });
  });

  it('restricts a MANAGER to inviting STAFF only and notes it', () => {
    mocks.memberRole = 'MANAGER';
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Mời thành viên' }));
    const role = screen.getByLabelText('Vai trò:') as HTMLSelectElement;
    expect(role.querySelectorAll('option').length).toBe(1);
    expect(role.querySelector('option')?.value).toBe('STAFF');
    expect(screen.getByText('Quản lý chỉ có thể mời nhân viên.')).toBeDefined();
  });

  it('renders empty zero-state when no members', () => {
    mocks.members = [];
    render(<AgencyTeamPage />);
    expect(screen.getByText('Chưa có thành viên nào.')).toBeDefined();
  });
});
