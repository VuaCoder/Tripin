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
  useTeamWorkToursQuery: () => ({ data: [] }),
  useSaveTeamRoleMutation: () => [mocks.mutate, {}], useSaveMemberAccessMutation: () => [mocks.mutate, {}],
  useChangeTeamMemberMutation: () => [mocks.mutate, {}], useInviteTeamMemberMutation: () => [mocks.mutate, {}],
  useRevokeTeamInvitationMutation: () => [mocks.mutate, {}], useSaveMemberTourScopesMutation: () => [mocks.mutate, {}],
}));
beforeEach(() => { mocks.invitations.length = 0; mocks.agency.permissions = [...mocks.permissions]; mocks.agency.memberRole = 'OWNER'; mocks.agency.isPrimaryOwner = true; mocks.agency.memberId = 'member-owner'; Object.assign(mocks.members[1], { status: 'ACTIVE', role: 'STAFF', roleId: mocks.role.id, roleName: mocks.role.name }); vi.clearAllMocks(); });
afterEach(cleanup);
function openAccess() {
  render(<AgencyTeamPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa Traveler Accountant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa quyền' }));
}
function selectRole(label: string) {
  fireEvent.click(screen.getByRole('radio', { name: label }));
}
describe('team permission editor', () => {
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
  it('moves invitation history and revocation to a separate full-width view', async () => {
    mocks.invitations.push({ id: 'invite-a', email: 'invitee@test.local', roleId: mocks.basicRole.id, role: 'STAFF', status: 'PENDING', expiresAt: new Date(Date.now() + 86400000).toISOString() });
    render(<AgencyTeamPage />);
    expect(screen.queryByText('invitee@test.local')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Lời mời đã gửi' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.getByRole('button', { name: 'Lời mời' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Lời mời đã gửi' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Đội ngũ hiện tại' })).toBeNull();
    expect(screen.getByText('invitee@test.local')).toBeDefined();
    expect(screen.getByText('1 đang chờ')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith('invite-a'));
  });
  it('keeps invitation creation available and shows the empty state in its own tab', () => {
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Lời mời' }));
    expect(screen.getByText('Chưa có lời mời nào.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm thành viên' }));
    expect(screen.getByRole('dialog', { name: 'Thêm thành viên' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thành viên' }));
    expect(screen.getByRole('heading', { name: 'Đội ngũ hiện tại' })).toBeDefined();
    expect(screen.queryByText('Chưa có lời mời nào.')).toBeNull();
  });
  it('shows actual contact, verification and workplace dates in the employee profile', () => {
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa Traveler Accountant' }));
    expect(screen.getByRole('dialog', { name: 'Hồ sơ nhân viên' })).toBeDefined();
    expect(screen.getByText('0901234567')).toBeDefined();
    expect(screen.getByText('Đã xác minh')).toBeDefined();
    expect(screen.getByText('Ngày tham gia')).toBeDefined();
    expect(screen.getByText('Cập nhật gần nhất')).toBeDefined();
    expect(screen.getByText('Agency A', { selector: 'dd' })).toBeDefined();
  });
  it.each(['close', 'escape', 'cancel'])('returns from the separate permission popup via %s and discards unsaved edits', action => {
    openAccess();
    const accessDialog = screen.getByRole('dialog', { name: 'Chỉnh sửa phân quyền' });
    selectRole('Nhân viên');
    if (action === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: action === 'cancel' ? 'Hủy' : 'Đóng hộp thoại' }));
    expect(screen.getByRole('dialog', { name: 'Hồ sơ nhân viên' })).not.toBe(accessDialog);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa quyền' }));
    expect((screen.getByRole('radio', { name: 'Finance reader' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(true);
  });
  it('returns to the employee profile after saving and only keeps one selected role', async () => {
    openAccess();
    selectRole('Nhân viên');
    expect(screen.getAllByRole('radio').filter(input => (input as HTMLInputElement).checked)).toHaveLength(1);
    mocks.refetch.mockReturnValueOnce({ unwrap: () => Promise.resolve(mocks.members.map(member => member.id === 'member-traveler' ? { ...member, roleId: mocks.basicRole.id, roleName: mocks.basicRole.name, permissions: mocks.basicRole.permissions } : member)) });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Hồ sơ nhân viên' })).toBeDefined());
    expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa phân quyền' })).toBeNull();
    expect(screen.getByText('Nhân viên')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa quyền' }));
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
  });
  it('keeps the permission popup and selections open if saving fails', async () => {
    openAccess();
    selectRole('Nhân viên');
    mocks.mutate.mockReturnValueOnce({ unwrap: () => Promise.reject({ data: { error: { message: 'Không lưu được quyền. Thử lại.' } } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Chỉnh sửa phân quyền' }).textContent).toContain('Không lưu được quyền. Thử lại.'));
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: 'Cập nhật quyền' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'Hồ sơ nhân viên' })).toBeNull();
  });
  it('keeps the editor copy compact with roles as single-choice ticks and no helper notes', () => {
    openAccess();
    expect(screen.queryByText('Đổi vai trò sẽ đặt lại các quyền bên dưới.')).toBeNull();
    expect(screen.queryByText('Tick để cấp quyền, bỏ tick để tắt.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thông tin nhân viên' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Vai trò' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Finance reader' }).getAttribute('type')).toBe('radio');
    expect(screen.queryByText('Quyền bắt buộc')).toBeNull();
    expect(screen.queryByText(/Một số tính năng/)).toBeNull();
    expect(screen.queryByText(/quyền hiện tại/)).toBeNull();
    expect(screen.queryByText(/Chọn vai trò để áp dụng/)).toBeNull();
  });
  it('uses concise permission names without parenthetical implementation notes', () => {
    for (const permission of ['promotion:agency-manage', 'complaint:respond', 'review:dispute', 'premium:contribute']) {
      expect(permissionLabels[permission]).not.toMatch(/[()]/);
    }
  });
  it('adds a co-owner only after explicit confirmation and uses the ownership API', async () => {
    openAccess();
    selectRole('Co_Owner');
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Bạn vẫn là Owner');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thêm Co_Owner' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', role: 'OWNER' }));
  });
  it('does not offer ownership to a manager even with team and permission management grants', () => {
    mocks.agency.memberRole = 'MANAGER';
    openAccess();
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('does not offer ownership to a suspended member', () => {
    mocks.members[1].status = 'SUSPENDED';
    openAccess();
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('clears the ownership confirmation when a different role is selected', () => {
    openAccess();
    selectRole('Co_Owner');
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    selectRole('Finance reader');
    expect(screen.queryByRole('button', { name: 'Xác nhận thêm Co_Owner' })).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('lets the primary owner downgrade a co-owner through the ownership API', async () => {
    Object.assign(mocks.members[1], { role: 'OWNER', roleId: mocks.ownerRole.id, roleName: 'Co_Owner' });
    openAccess();
    expect((screen.getByRole('button', { name: 'Cập nhật quyền' }) as HTMLButtonElement).disabled).toBe(true);
    selectRole('Nhân viên');
    expect((screen.getByRole('radio', { name: 'Nhân viên' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'Co_Owner' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', role: 'STAFF' }));
  });
  it('keeps the primary owner read-only for a co-owner and hides ownership promotion', () => {
    mocks.agency.isPrimaryOwner = false;
    mocks.agency.memberId = 'coowner-actor';
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem thông tin Owner' }));
    expect(screen.queryByRole('button', { name: 'Đình chỉ thành viên' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xem quyền' }));
    expect(screen.queryByRole('combobox', { name: 'Vai trò' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa Traveler Accountant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa quyền' }));
    expect(screen.queryByText('Co_Owner')).toBeNull();
  });
  it('aligns member columns with an equal-width action for view and edit labels', () => {
    render(<AgencyTeamPage />);
    const owner = screen.getByRole('heading', { name: 'Owner (bạn)' }).closest('li')!;
    const staff = screen.getByRole('heading', { name: 'Traveler Accountant' }).closest('li')!;
    expect(owner.className).toBe(staff.className);
    expect(owner.className).toContain('sm:grid-cols-[minmax(0,1fr)_10rem_12rem_9rem]');
    const viewButton = screen.getByRole('button', { name: 'Xem thông tin Owner' });
    const editButton = screen.getByRole('button', { name: 'Chỉnh sửa Traveler Accountant' });
    expect(viewButton.className).toBe(editButton.className);
    expect(editButton.className).toContain('w-full whitespace-nowrap');
    fireEvent.click(editButton);
    expect(screen.getByRole('dialog')).toBeDefined();
  });
  it('shows organization-local members and never assumes a global AGENCY role', () => {
    render(<AgencyTeamPage />);
    expect(screen.getByRole('heading', { name: 'Traveler Accountant' })).toBeDefined();
    expect(screen.queryByText('traveler@test.local')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa Traveler Accountant' }));
    expect(screen.getByText('traveler@test.local')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Thêm thành viên' })).toBeDefined();
  });
  it('persists a DENY override independently from the selected role', async () => {
    openAccess();
    const finance = screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement;
    expect(finance.checked).toBe(true);
    fireEvent.click(finance);
    expect(finance.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [{ permission: 'agency:finance-view', effect: 'DENY' }] }));
  });
  it('grants an extra permission by ticking it', async () => {
    openAccess();
    const tour = screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' }) as HTMLInputElement;
    expect(tour.checked).toBe(false);
    fireEvent.click(tour);
    expect(tour.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [{ permission: 'agency:tour-view', effect: 'ALLOW' }] }));
  });
  it('removes an extra grant when unticked and restores a role permission when reticked', async () => {
    openAccess();
    const tour = screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' });
    const finance = screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' });
    fireEvent.click(tour); fireEvent.click(tour);
    fireEvent.click(finance); fireEvent.click(finance);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-finance', overrides: [] }));
  });
  it('keeps the current owner view-only even though permissions are shown as checkboxes', () => {
    render(<AgencyTeamPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem thông tin Owner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem quyền' }));
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cập nhật quyền' })).toBeNull();
  });
  it('uses the selected role as the new checkbox preset and clears previous customizations', async () => {
    openAccess();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }));
    selectRole('Nhân viên');
    expect((screen.getByRole('checkbox', { name: 'Xem tour và lịch chỗ' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật quyền' }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ id: 'member-traveler', roleId: 'role-basic', overrides: [] }));
  });
  it('keeps all permission sections open, preserves changes through search and allows reset to the role', () => {
    openAccess();
    expect(screen.getByRole('group', { name: 'Tài chính' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Tour và lịch khởi hành' })).toBeDefined();
    expect(screen.getByRole('dialog').querySelector('details')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Kế thừa' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm quyền' }), { target: { value: 'tour' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm quyền' }), { target: { value: '' } });
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại theo vai trò' }));
    expect((screen.getByRole('checkbox', { name: 'Xem tổng quan tài chính' }) as HTMLInputElement).checked).toBe(true);
  });
  it('locks mandatory access and prevents granting permissions the actor does not hold', () => {
    mocks.agency.permissions = mocks.permissions.filter(p => p !== 'tour:update-own');
    openAccess();
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
  it('uses separate read, create, import, edit and team route gates', () => {
    expect(agencyRoutePermission('/agency/team')).toBe('agency:team-view');
    expect(agencyRoutePermission('/agency/tours')).toBe('agency:tour-view');
    expect(agencyRoutePermission('/agency/tours/new')).toBe('tour:create');
    expect(agencyRoutePermission('/agency/tours/import')).toBe('tour:import');
    expect(agencyRoutePermission('/agency/tours/123/edit')).toBe('tour:update-own');
    expect(agencyRoutePermission('/agency/work/bookings')).toBe('agency:booking-monitor');
  });
});
