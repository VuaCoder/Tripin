import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgencyTeamPage } from '../AgencyTeamPage';
vi.mock('../AgencyJoinPanel', () => ({ AgencyJoinPanel: () => null }));
import { agencyRoutePermission } from '../agencyRoutePermission';
import { permissionLabels } from '../permissionLabels';

const mocks = vi.hoisted(() => {
  const permissions = ['agency:context-view','agency:team-view','agency:team-invite','agency:team-manage','agency:permissions-manage','agency:finance-view','agency:tour-view','tour:update-own'];
  const role = { id: 'role-finance', name: 'Finance reader', systemRole: null, permissions: ['agency:context-view','agency:finance-view'] };
  const ownerRole = { id: 'role-owner', name: 'Agency Owner', systemRole: 'OWNER', permissions };
  const basicRole = { id: 'role-basic', name: 'Nhân viên', systemRole: 'STAFF', permissions: ['agency:context-view','agency:tour-view'] };
  const members = [{ id: 'member-owner', userId: 'owner', isPrimaryOwner: true, role: 'OWNER', roleId: ownerRole.id, roleName: 'Owner', status: 'ACTIVE', user: { fullName: 'Owner', email: 'owner@test.local' }, permissions, overrides: [], tourScopes: [] },
    { id: 'member-traveler', userId: 'traveler', role: 'STAFF', roleId: role.id, roleName: role.name, status: 'ACTIVE', createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-12T08:00:00Z', user: { fullName: 'Traveler Accountant', email: 'traveler@test.local', phone: '0901234567', avatarUrl: null, emailVerifiedAt: '2026-11-01T08:00:00Z' }, permissions: role.permissions, overrides: [], tourScopes: [] }];
  const mutate = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));
  return { permissions, role, ownerRole, basicRole, members, mutate, invitations: [] as { id: string; email: string; roleId: string; role: string; status: string; expiresAt: string }[], agency: { agencyId: 'agency-a', actorUserId: 'owner', memberId: 'member-owner', memberRole: 'OWNER', isPrimaryOwner: true, roleId: 'role-owner', companyName: 'Agency A', permissions: [...permissions] },
    refetch: vi.fn(() => ({ unwrap: () => Promise.resolve(members) })), dispatch: vi.fn(() => ({ unwrap: () => Promise.resolve([]), unsubscribe: vi.fn() })) };
});
vi.mock('@/store/hooks', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../agencyContext', () => ({ useAgencyContext: () => mocks.agency, agencyContextApi: { endpoints: { agencyMemberships: { initiate: vi.fn() } } } }));
vi.mock('../teamApi', () => ({
  useTeamMembersQuery: () => ({ data: mocks.members, refetch: mocks.refetch }),
  useTeamRolesQuery: () => ({ data: [mocks.ownerRole, mocks.role, mocks.basicRole], refetch: mocks.refetch }),
  useTeamPermissionsQuery: () => ({ data: mocks.permissions }),
  useTeamInvitationsQuery: () => ({ data: mocks.invitations, refetch: mocks.refetch }),
  useSaveTeamRoleMutation: () => [mocks.mutate, {}], useSaveMemberAccessMutation: () => [mocks.mutate, {}],
  useChangeTeamMemberMutation: () => [mocks.mutate, {}], useInviteTeamMemberMutation: () => [mocks.mutate, {}],
  useRevokeTeamInvitationMutation: () => [mocks.mutate, {}],
}));
beforeEach(() => {
  mocks.invitations.length = 0;
  mocks.agency.permissions = [...mocks.permissions];
  mocks.agency.memberRole = 'OWNER';
  mocks.agency.isPrimaryOwner = true;
  mocks.agency.memberId = 'member-owner';
  Object.assign(mocks.members[1], { status: 'ACTIVE', role: 'STAFF', roleId: mocks.role.id, roleName: mocks.role.name, permissions: mocks.role.permissions, overrides: [] });
  vi.clearAllMocks();
});
afterEach(cleanup);
function openMember(name = 'Traveler Accountant') {
  render(<AgencyTeamPage />);
  fireEvent.click(screen.getByRole('button', { name: `Phân quyền ${name}` }));
}
function selectRole(label: string) {
  fireEvent.click(screen.getByRole('radio', { name: label }));
}
describe('team page', () => {
  it('hides removed members without mutating their saved membership', () => {
    mocks.members[1].status = 'REMOVED';
    render(<AgencyTeamPage />);
    expect(screen.queryByRole('heading', { name: 'Traveler Accountant' })).toBeNull();
    expect(screen.queryByText('Đã gỡ khỏi doanh nghiệp')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Owner (bạn)' })).toBeDefined();
    expect(mocks.members[1].status).toBe('REMOVED');
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('keeps suspended members visible for reactivation', () => {
    mocks.members[1].status = 'SUSPENDED';
    render(<AgencyTeamPage />);
    expect(screen.getByRole('heading', { name: 'Traveler Accountant' })).toBeDefined();
    expect(screen.getByText('Tạm đình chỉ')).toBeDefined();
  });
  it('invites straight from the page instead of a popup', async () => {
    render(<AgencyTeamPage />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'new@test.local' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Vai trò' }), { target: { value: mocks.basicRole.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ email: 'new@test.local', roleId: mocks.basicRole.id, role: 'STAFF' }));
  });
  it('lists pending invitations in the same screen and revokes them there', async () => {
    mocks.invitations.push({ id: 'invite-a', email: 'invitee@test.local', roleId: mocks.basicRole.id, role: 'STAFF', status: 'PENDING', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    render(<AgencyTeamPage />);
    expect(screen.getByRole('heading', { name: 'Lời mời đã gửi' })).toBeDefined();
    expect(screen.getByText('invitee@test.local')).toBeDefined();
    expect(screen.getByText('1 đang chờ')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith('invite-a'));
  });
  it('shows the empty invitation state without asking for a tab switch', () => {
    render(<AgencyTeamPage />);
    expect(screen.getByText('Chưa có lời mời nào.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Đội ngũ hiện tại' })).toBeDefined();
  });
  it('shows contact, verification and workplace dates inline on the member', () => {
    openMember();
    expect(screen.getByText('traveler@test.local')).toBeDefined();
    expect(screen.getByText('0901234567')).toBeDefined();
    expect(screen.getByText('Đã xác minh')).toBeDefined();
    expect(screen.getByText('Ngày tham gia')).toBeDefined();
  });
  it('keeps member emails out of the collapsed list', () => {
    render(<AgencyTeamPage />);
    expect(screen.getByRole('heading', { name: 'Traveler Accountant' })).toBeDefined();
    expect(screen.queryByText('traveler@test.local')).toBeNull();
  });
  it('discards unsaved permission edits when the member block is closed', () => {
    openMember();
    selectRole('Nhân viên');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('radio')).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Phân quyền Traveler Accountant' }));
    expect((screen.getByRole('radio', { name: 'Finance reader' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(true);
  });
  it('saves the edited member and reopens on the saved role', async () => {
    openMember();
    selectRole('Nhân viên');
    expect(screen.getAllByRole('radio').filter(input => (input as HTMLInputElement).checked)).toHaveLength(1);
    mocks.refetch.mockReturnValueOnce({ unwrap: () => { Object.assign(mocks.members[1], { roleId: mocks.basicRole.id, roleName: mocks.basicRole.name, permissions: mocks.basicRole.permissions }); return Promise.resolve(mocks.members); } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-basic', overrides: [] }));
    await waitFor(() => expect(screen.queryByRole('radio')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Phân quyền Traveler Accountant' }));
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
  });
  it('keeps the member block and its selections open if saving fails', async () => {
    openMember();
    selectRole('Nhân viên');
    mocks.mutate.mockReturnValueOnce({ unwrap: () => Promise.reject({ data: { error: { message: 'Không lưu được quyền. Thử lại.' } } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Không lưu được quyền. Thử lại.'));
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: 'Lưu thay đổi' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('keeps the editor copy compact with roles as single-choice ticks and no helper notes', () => {
    openMember();
    expect(screen.queryByText('Đổi vai trò sẽ đặt lại các quyền bên dưới.')).toBeNull();
    expect(screen.queryByText('Tick để cấp quyền, bỏ tick để tắt.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thông tin nhân viên' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Vai trò' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Finance reader' }).getAttribute('type')).toBe('radio');
    expect(screen.queryByText('Quyền bắt buộc')).toBeNull();
    expect(screen.queryByText(/Một số tính năng/)).toBeNull();
    expect(screen.queryByText(/Chọn vai trò để áp dụng/)).toBeNull();
  });
  it('uses concise permission names without parenthetical implementation notes', () => {
    for (const permission of ['promotion:agency-manage', 'complaint:respond', 'review:dispute', 'premium:contribute']) {
      expect(permissionLabels[permission]).not.toMatch(/[()]/);
    }
  });
  it('adds a co-owner only after explicit confirmation and uses the ownership API', async () => {
    openMember();
    selectRole('Co_Owner');
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Bạn vẫn là Owner');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thêm Co_Owner' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', role: 'OWNER' }));
  });
  it('does not offer ownership to a manager even with team and permission management grants', () => {
    mocks.agency.memberRole = 'MANAGER';
    openMember();
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('does not offer ownership to a suspended member', () => {
    mocks.members[1].status = 'SUSPENDED';
    openMember();
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('clears the ownership confirmation when a different role is selected', () => {
    openMember();
    selectRole('Co_Owner');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    selectRole('Finance reader');
    expect(screen.queryByRole('button', { name: 'Xác nhận thêm Co_Owner' })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('lets the primary owner downgrade a co-owner through the ownership API', async () => {
    Object.assign(mocks.members[1], { role: 'OWNER', roleId: mocks.ownerRole.id, roleName: 'Co_Owner' });
    openMember();
    expect((screen.getByRole('button', { name: 'Lưu thay đổi' }) as HTMLButtonElement).disabled).toBe(true);
    selectRole('Nhân viên');
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'Co_Owner' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', role: 'STAFF' }));
  });
  it('keeps the primary owner read-only for a co-owner actor and hides ownership promotion', () => {
    mocks.agency.isPrimaryOwner = false;
    mocks.agency.memberId = 'coowner-actor';
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem quyền Owner' }));
    expect(screen.queryByRole('button', { name: 'Đình chỉ thành viên' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull();
    expect((screen.getByRole('radio', { name: 'Owner' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Phân quyền Traveler Accountant' }));
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('shows organization-local members and never assumes a global AGENCY role', () => {
    render(<AgencyTeamPage />);
    expect(screen.getByRole('heading', { name: 'Traveler Accountant' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Gửi lời mời' })).toBeDefined();
  });
  it('persists a DENY override independently from the selected role', async () => {
    openMember();
    const finance = screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement;
    expect(finance.checked).toBe(true);
    fireEvent.click(finance);
    expect(finance.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [{ permission: 'agency:finance-view', effect: 'DENY' }] }));
  });
  it('grants an extra permission by ticking it', async () => {
    openMember();
    const tour = screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' }) as HTMLInputElement;
    expect(tour.checked).toBe(false);
    fireEvent.click(tour);
    expect(tour.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [{ permission: 'agency:tour-view', effect: 'ALLOW' }] }));
  });
  it('removes an extra grant when unticked and restores a role permission when reticked', async () => {
    openMember();
    const tour = screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' });
    const finance = screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' });
    fireEvent.click(tour); fireEvent.click(tour);
    fireEvent.click(finance); fireEvent.click(finance);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [] }));
  });
  it('keeps the current owner view-only even though permissions are shown as checkboxes', () => {
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem quyền Owner' }));
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull();
  });
  it('uses the selected role as the new checkbox preset and clears previous customizations', async () => {
    openMember();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }));
    selectRole('Nhân viên');
    expect((screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-basic', overrides: [] }));
  });
  it('keeps all permission sections open and allows reset to the role', () => {
    openMember();
    expect(screen.getByRole('group', { name: 'Tài chính' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Tour và lịch khởi hành' })).toBeDefined();
    expect(document.querySelector('details')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Kế thừa' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại theo vai trò' }));
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(true);
  });
  it('locks mandatory access and prevents granting permissions the actor does not hold', () => {
    mocks.agency.permissions = mocks.permissions.filter(p => p !== 'tour:update-own');
    openMember();
    const mandatory = screen.getByRole('checkbox', { name: 'Truy cập doanh nghiệp' }) as HTMLInputElement;
    expect(mandatory.checked).toBe(true); expect(mandatory.disabled).toBe(true);
    const restricted = screen.getByRole('checkbox', { name: 'Chỉnh sửa toàn bộ nội dung tour' }) as HTMLInputElement;
    expect(restricted.checked).toBe(false); expect(restricted.disabled).toBe(true);
  });
  it('creates a custom role rather than requiring one of four enum labels', async () => {
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Role & bộ quyền' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo role tùy chỉnh' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên role' }), { target: { value: 'Finance assistant' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bộ quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ name: 'Finance assistant', permissions: ['agency:context-view','agency:finance-view'] }));
  });
  it('does not show a team interface without the effective team permission', () => {
    mocks.agency.permissions = ['agency:context-view'];
    render(<AgencyTeamPage />);
    expect(screen.getByRole('alert').textContent).toContain('không có quyền');
    expect(screen.queryByRole('button', { name: 'Gửi lời mời' })).toBeNull();
  });
  it('gates the single team entry and no longer the removed settings page', () => {
    expect(agencyRoutePermission('/agency/team')).toBe('agency:team-view');
    expect(agencyRoutePermission('/agency/settings/team')).toBeNull();
    expect(agencyRoutePermission('/agency/settings/commission')).toBeNull();
  });
});
