import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { clearCredentials, setCredentials } from '@/features/auth/store/authSlice';
import type { AgencyMembership, SessionData } from '@/features/auth/types';
import { baseApi } from '@/store/api/baseApi';
import { identityIsolation } from '@/store/api/identityIsolation';
import { membershipFixture } from '@/test/agencySession';
import { CreateWorkplacePage, WorkplacesPage } from '../WorkplacesPage';
import { WorkplaceWizard } from '../WorkplaceWizard';
import { AgencyJoinPanel } from '../AgencyJoinPanel';
import { AgencyJoinRequestsPage } from '../AgencyJoinRequestsPage';
import { workplacesApi } from '../workplacesApi';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));
const owner = membershipFixture({ memberRole: 'OWNER', permissions: ['agency:context-view','agency:team-view','agency:team-manage','agency:permissions-manage','agency:tour-view'] });
const createStore = () => configureStore({ reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer }, middleware: d => d().concat(identityIsolation, baseApi.middleware) });
const stores: ReturnType<typeof createStore>[] = [];
function storeFor(agencies: AgencyMembership[] = []) {
  const store = createStore();
  store.dispatch(setCredentials({ accessToken: 'test-token', user: { id: 'user-a', role: 'TRAVELER', fullName: 'An', email: 'an@test.local', permissions: [] }, agencies } as unknown as SessionData));
  stores.push(store); return store;
}
function mount(node: React.ReactNode, agencies: AgencyMembership[] = []) { return render(<Provider store={storeFor(agencies)}>{node}</Provider>); }
const json = (data: unknown, status = 200) => Response.json({ success: status < 400, data, ...(status >= 400 ? { error: { message: 'Please retry' } } : {}) }, { status });
beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
afterEach(() => { cleanup(); stores.splice(0).forEach(s => s.dispatch(baseApi.util.resetApiState())); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe('workplace flows with real authenticated API store', () => {
  it('opens legacy join URLs as a dialog and keeps the local continuation when closing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => json(req.url.includes('/agency-invitations') ? { items: [], total: 0, page: 1, pageSize: 20 } : [])));
    mount(<WorkplacesPage openJoin nextPath="/agency/work/tours" />);
    expect(screen.getByRole('dialog', { name: 'Nhập mã mời' })).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/workplaces?next=%2Fagency%2Fwork%2Ftours');
    expect(screen.getByRole('heading', { name: 'Chọn nơi làm việc' })).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nhập mã mời' })));
  });
  it('validates the code before sending and keeps a rejected code in the same dialog', async () => {
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { writes.push(await req.json()); return Response.json({ success: false, error: { message: 'Mã mời đã hết hạn. Hãy xin mã mới.' } }, { status: 400 }); }
      return json(req.url.includes('/agency-invitations') ? { items: [], total: 0, page: 1, pageSize: 20 } : []);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nhập mã mời' }));
    fireEvent.change(screen.getByLabelText('Mã mời'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tham gia' }));
    expect(screen.getByRole('alert').textContent).toContain('12 chữ cái hoặc chữ số');
    expect(writes).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Mã mời'), { target: { value: 'ABCDEFGHJKMN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tham gia' }));
    await screen.findByText('Mã mời đã hết hạn. Hãy xin mã mới.');
    expect((screen.getByLabelText('Mã mời') as HTMLInputElement).value).toBe('ABCDEFGHJKMN');
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(nav.push).not.toHaveBeenCalled();
  });
  it('uses the inbox total rather than the page size and loads the next page', async () => {
    const pages: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (!req.url.includes('/users/me/agency-invitations')) return json([]);
      const page = new URL(req.url).searchParams.get('page'); pages.push(page ?? '');
      return json({ items: [{ id: page, agency: { id: page, companyName: `Company page ${page}` }, roleName: 'Nhân viên', expiresAt: '2030-01-01' }], total: 21, page: Number(page), pageSize: 20 });
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lời mời của tôi (21)' }));
    await screen.findByRole('heading', { name: 'Company page 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByRole('heading', { name: 'Company page 2' });
    expect(pages).toEqual(['1','2']);
    expect(screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true);
  });
  it('does not refresh the old account or show success when acceptance finishes after logout', async () => {
    let resolveAccept!: (response: Response) => void;
    let writeCount = 0;
    const reads: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { writeCount++; return new Promise<Response>(resolve => { resolveAccept = resolve; }); }
      reads.push(req.url);
      if (req.url.includes('/users/me/agency-invitations')) return json({ items: [{ id: 'i', agency: { id: 'a', companyName: 'Old account invite' }, roleName: 'Nhân viên', expiresAt: '2030-01-01' }], total: 1, page: 1, pageSize: 20 });
      return json([]);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lời mời của tôi (1)' }));
    const button = await screen.findByRole('button', { name: 'Chấp nhận lời mời Old account invite' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(writeCount).toBe(1));
    stores[0].dispatch(clearCredentials());
    const readCount = reads.length;
    resolveAccept(json({ invitationId: 'i', agencyId: 'a', memberId: 'm' }));
    await waitFor(() => expect(stores[0].getState().auth.user).toBeNull());
    expect(reads.length).toBe(readCount);
    expect(screen.queryByText('Bạn đã tham gia Old account invite.')).toBeNull();
    expect(stores[0].getState().auth.agencies).toEqual([]);
  });
  it('accepts a personal email invitation without a tenant and refreshes memberships without navigating', async () => {
    let accepted = false;
    const writes: { url: string; tenant: string | null; body: unknown }[] = [];
    const invitation = { id: 'invite-a', agency: { id: owner.agencyId, companyName: 'Agency mời' }, roleName: 'Nhân viên', expiresAt: '2030-11-14T10:00:00Z', createdAt: '2030-11-13T10:00:00Z' };
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { writes.push({ url: req.url, tenant: req.headers.get('X-Agency-Id'), body: await req.json() }); accepted = true; return json({ invitationId: invitation.id, agencyId: owner.agencyId, memberId: 'joined' }); }
      if (req.url.includes('/users/me/agency-invitations')) return json({ items: accepted ? [] : [invitation], total: accepted ? 0 : 1, page: 1, pageSize: 20 });
      if (req.url.includes('/users/me/agencies')) return json(accepted ? [{ ...owner, companyName: 'Agency mời', memberRole: 'STAFF' }] : []);
      return json([]);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lời mời của tôi (1)' }));
    await screen.findByRole('heading', { name: 'Agency mời' });
    fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận lời mời Agency mời' }));
    await screen.findByText('Bạn đã tham gia Agency mời.');
    await screen.findByRole('button', { name: 'Mở doanh nghiệp Agency mời' });
    await screen.findByRole('tab', { name: 'Lời mời của tôi (0)' });
    expect(writes).toHaveLength(1); expect(writes[0].tenant).toBeNull(); expect(writes[0].body).toEqual({});
    expect(nav.push).not.toHaveBeenCalled();
    expect(stores[0].getState().auth.user?.role).toBe('TRAVELER');
  });
  it('keeps a committed acceptance separate from a membership-refresh error', async () => {
    let accepted = false;
    let writes = 0;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { accepted = true; writes++; return json({ agencyId: owner.agencyId, memberId: 'joined', invitationId: 'i' }); }
      if (req.url.includes('/users/me/agency-invitations')) return json({ items: accepted ? [] : [{ id: 'i', agency: { id: owner.agencyId, companyName: 'Company' }, roleName: 'Nhân viên', expiresAt: '2030-01-01' }], total: accepted ? 0 : 1, page: 1, pageSize: 20 });
      if (req.url.includes('/users/me/agencies')) return accepted ? json(null, 500) : json([]);
      return json([]);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lời mời của tôi (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chấp nhận lời mời Company' }));
    await screen.findByText(/Đã chấp nhận lời mời nhưng chưa tải được doanh nghiệp/);
    expect(screen.getByText('Bạn đã tham gia Company.')).toBeDefined();
    expect(writes).toBe(1);
  });
  it('does not hide workplace data or fake a zero count when the invitation inbox fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => req.url.includes('/users/me/agency-invitations') ? json(null, 500) : json(req.url.includes('/users/me/agencies') ? [owner] : [])));
    mount(<WorkplacesPage />, [owner]);
    await screen.findByRole('button', { name: `Mở doanh nghiệp ${owner.companyName}` });
    const inboxTab = screen.getByRole('tab', { name: 'Lời mời của tôi' });
    fireEvent.keyDown(screen.getByRole('tab', { name: /Doanh nghiệp/ }), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inboxTab);
    await screen.findByText('Không tải được lời mời.');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDefined();
  });
  it('refreshes an expired invitation and shows its server error instead of adding membership', async () => {
    let stale = false;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { stale = true; return Response.json({ success: false, error: { message: 'Lời mời đã hết hạn.' } }, { status: 409 }); }
      if (req.url.includes('/users/me/agency-invitations')) return json({ items: stale ? [] : [{ id: 'i', agency: { id: 'a', companyName: 'Expired' }, roleName: 'Staff', expiresAt: '2030-01-01' }], total: stale ? 0 : 1, page: 1, pageSize: 20 });
      return json([]);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Lời mời của tôi (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chấp nhận lời mời Expired' }));
    await screen.findByText('Lời mời đã hết hạn.');
    await screen.findByRole('heading', { name: 'Bạn chưa có lời mời nào' });
    expect(stores[0].getState().auth.agencies).toEqual([]);
  });
  it('lists different roles for one personal account and selects the chosen agency', async () => {
    const staff = { ...owner, agencyId: '22222222-2222-4222-8222-222222222222', memberId: 'staff-b', companyName: 'Agency B', memberRole: 'STAFF' as const, roleName: 'Staff B' };
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => json(req.url.includes('/users/me/agencies') ? [owner,staff] : [])));
    mount(<WorkplacesPage />, [owner,staff]);
    await screen.findByRole('heading', { name: 'Agency B' });
    fireEvent.click(screen.getByRole('button', { name: 'Mở doanh nghiệp Agency B' }));
    expect(stores[0].getState().auth.activeAgencyId).toBe(staff.agencyId);
    expect(stores[0].getState().auth.user?.role).toBe('TRAVELER');
    expect(nav.push).toHaveBeenCalledWith('/agency/work/tours');
  });
  it('retains creation idempotency key after a failed response without requiring a membership', async () => {
    const sent: { body: Record<string, unknown>; tenant: string | null }[] = [];
    let created = false;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'GET') return json(created ? [{ ...owner, agencyId: 'new-agency' }] : []);
      sent.push({ body: await req.json(), tenant: req.headers.get('X-Agency-Id') });
      if (sent.length === 1) return json(null,500);
      created = true; return json({ id: 'new-agency' },201);
    }));
    mount(<CreateWorkplacePage />);
    fireEvent.change(screen.getByLabelText(/Tên doanh nghiệp/), { target: { value: 'Agency mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/agency/application/workplace?step=2'));
    expect(sent).toHaveLength(2); expect(sent[0].body.requestId).toBe(sent[1].body.requestId); expect(sent[0].tenant).toBeNull();
  });
  it('joins with normalized code and waits for approval without creating local permissions', async () => {
    const sent: unknown[] = [];
    const joined = { id: 'request-1', agencyId: 'agency-a', status: 'PENDING', createdAt: '2026-11-14T00:00:00Z', agency: { companyName: 'Agency nhận' } };
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.method === 'POST') { sent.push(await req.json()); return json(joined, 201); }
      if (req.url.includes('/agency-invitations')) return json({ items: [], total: 0, page: 1, pageSize: 20 });
      return json(req.url.includes('/agency-join-requests') && sent.length ? [joined] : []);
    }));
    mount(<WorkplacesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Nhập mã mời' }));
    fireEvent.change(screen.getByLabelText(/Mã mời/), { target: { value: 'abcd-efgh-jkmn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tham gia' }));
    await screen.findByText('Đã gửi yêu cầu tới Agency nhận. Vui lòng chờ duyệt.');
    await screen.findByRole('heading', { name: 'Agency nhận' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Yêu cầu đã gửi' }).getAttribute('aria-selected')).toBe('true');
    expect(nav.push).not.toHaveBeenCalled();
    expect(sent).toEqual([{ code: 'ABCDEFGHJKMN' }]);
    expect(stores[0].getState().auth.agencies).toEqual([]);
  });
  it('offers create and join directly in the selector and preserves the selected tab on cancellation', async () => {
    const writes: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => { if (req.method === 'POST') writes.push(req.url); return json(req.url.includes('/agency-invitations') ? { items: [], total: 0, page: 1, pageSize: 20 } : []); }));
    mount(<WorkplacesPage />);
    await screen.findByRole('heading', { name: 'Bạn chưa có nơi làm việc nào' });
    expect(screen.getByRole('link', { name: 'Tạo doanh nghiệp' }).getAttribute('href')).toBe('/workplaces/new');
    fireEvent.click(screen.getByRole('tab', { name: /Lời mời của tôi/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhập mã mời' }));
    expect(screen.getByRole('dialog', { name: 'Nhập mã mời' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tab', { name: /Lời mời của tôi/ }).getAttribute('aria-selected')).toBe('true');
    expect(writes).toEqual([]);
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Bạn muốn bắt đầu thế nào?' })).toBeNull();
  });
  it('keeps one tenant through the document step and marks only a real submit as pending', async () => {
    const writes: { body: any; tenant: string | null; url: string }[] = [];
    const profile = { id: owner.agencyId, companyName: 'Doanh nghiệp An', address: 'Đà Nẵng', licenseNumber: '', taxId: '', businessLicenseUrl: '', website: '', description: '', verificationStatus: 'UNVERIFIED', verificationNote: null };
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      const body = await req.json(); writes.push({ body, tenant: req.headers.get('X-Agency-Id'), url: req.url });
      return json({ ...profile, ...body, verificationStatus: req.url.endsWith('/submit') ? 'PENDING' : 'UNVERIFIED' });
    }));
    mount(<WorkplaceWizard profile={profile} initialStep={2} onSaved={() => undefined} />, [owner]);
    fireEvent.change(screen.getByLabelText('Số giấy phép kinh doanh'), { target: { value: 'GP-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await screen.findByRole('heading', { name: 'Kiểm tra trước khi gửi' });
    expect(writes).toHaveLength(1);
    expect(screen.queryByText('Đã gửi hồ sơ xác minh')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi hồ sơ xác minh' }));
    await screen.findByRole('heading', { name: 'Đã gửi hồ sơ xác minh' });
    expect(writes).toHaveLength(2);
    expect(writes.every(w => w.tenant === owner.agencyId)).toBe(true);
    expect(writes[1].url).toMatch(/\/application\/submit$/);
    expect(writes[1].body.licenseNumber).toBe('GP-123');
    expect(screen.queryByText('Đã kích hoạt')).toBeNull();
  });
  it('requires role selection and confirmation on the separate OWNER requests page', async () => {
    const reviews: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.url.endsWith('/approve')) { reviews.push(await req.json()); return json({ status: 'APPROVED' }); }
      if (req.url.includes('/join-requests')) return json([{ id: 'request-1', agencyId: owner.agencyId, status: 'PENDING', agency: { companyName: 'A' }, user: { fullName: 'Nhân viên An', email: 'an@test.local' } }]);
      if (req.url.endsWith('/roles')) return json([{ id: 'staff-role', name: 'Agency Staff', systemRole: 'STAFF', permissions: ['agency:context-view'] }]);
      return json(null);
    }));
    mount(<AgencyJoinRequestsPage />, [owner]);
    await screen.findByText('Nhân viên An');
    expect(screen.getByRole('button', { name: 'Duyệt' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Vai trò cho Nhân viên An'), { target: { value: 'staff-role' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(reviews).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(reviews).toHaveLength(1));
    expect(reviews).toEqual([{ roleId: 'staff-role' }]);
  });
  it('does not resubmit an already verified business when saving ordinary profile changes', async () => {
    const profile = { id: owner.agencyId, companyName: 'Verified An', address: 'Đà Nẵng', licenseNumber: 'GP-123', taxId: '', businessLicenseUrl: '', website: '', description: '', verificationStatus: 'VERIFIED', verificationNote: null };
    const writes: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => { writes.push(req.url); return json(profile); }));
    mount(<WorkplaceWizard profile={profile} initialStep={3} onSaved={() => undefined} />, [owner]);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/workplaces'));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/\/application$/);
  });
  it('hides the revealed code when another session rotates the current code', async () => {
    const expiresAt = new Date(Date.now() + 900000).toISOString();
    let current: { id: string; expiresAt: string } | null = null;
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.url.endsWith('/join-codes') && req.method === 'POST') {
        current = { id: 'first-code', expiresAt };
        return json({ ...current, code: 'ABCDEFGHJKMN' });
      }
      if (req.url.endsWith('/current')) return json(current);
      return json([]);
    }));
    mount(<AgencyJoinPanel onMembershipChanged={async () => undefined} />, [owner]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo mã mời' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã mời' }));
    expect((await screen.findByLabelText('Mã mời')).textContent).toBe('ABCDEFGHJKMN');
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi mã' }));
    expect(screen.getByRole('button', { name: 'Xác nhận thu hồi' })).toBeDefined();
    current = { id: 'replacement-code', expiresAt };
    await stores[0].dispatch(workplacesApi.endpoints.currentJoinCode.initiate(owner.agencyId, { forceRefetch: true }));
    await waitFor(() => expect(screen.queryByLabelText('Mã mời')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Sao chép mã' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xác nhận thu hồi' })).toBeNull();
  });
  it('copies the raw code and asks for confirmation before revoking it', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const expiresAt = new Date(Date.now() + 900000).toISOString();
    let current: { id: string; expiresAt: string } | null = null;
    const revocations: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (req: Request) => {
      if (req.url.endsWith('/join-codes') && req.method === 'POST') { current = { id: 'code-a', expiresAt }; return json({ ...current, code: 'ABCDEFGHJKMN' }); }
      if (req.url.endsWith('/revoke')) { revocations.push(req.url); current = null; return json({ revoked: true }); }
      return json(current);
    }));
    mount(<AgencyJoinPanel />, [owner]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo mã mời' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã mời' }));
    await screen.findByLabelText('Mã mời');
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã' }));
    await screen.findByRole('button', { name: 'Đã sao chép' });
    expect(writeText).toHaveBeenCalledWith('ABCDEFGHJKMN');
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi mã' }));
    expect(revocations).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Giữ mã' }));
    expect(revocations).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi mã' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' }));
    await screen.findByText('Đã thu hồi mã. Các yêu cầu đã gửi vẫn được giữ.');
    expect(revocations).toHaveLength(1);
    expect(screen.queryByLabelText('Mã mời')).toBeNull();
  });
  it('never requests owner onboarding data for a STAFF membership', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    mount(<AgencyJoinPanel onMembershipChanged={async () => undefined} />, [{ ...owner, memberRole: 'STAFF' }]);
    expect(screen.queryByText('Mã và yêu cầu tham gia')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
