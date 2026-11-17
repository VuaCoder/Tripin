import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({role:'SUPER_ADMIN',error:false,action:vi.fn(),dashboard:vi.fn(),directory:vi.fn(),policyRefresh:vi.fn()}));
vi.mock('@/store/hooks',()=>({useAppSelector:()=>({id:'admin-1',role:mocks.role})}));
vi.mock('@/features/auth',()=>({selectUser:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams()}));
vi.mock('../walletApi',()=>({
  useAccountingDashboardQuery:(...args:unknown[])=>{mocks.dashboard(...args);return {isError:mocks.error,refetch:vi.fn(),currentData:mocks.error?undefined:{origin:'LIVE',gmv:'10000000',paid:'4000000',commission:'1000000',earnedCommission:'1000000',released:'9000000',asOf:'2026-11-17',balances:{pending:'0',available:'5000000',reserved:'0',frozen:'0'},cashflow:[],aging:[],tasks:{pending:1,processing:2,overdue:0,unverifiedBanks:1,unreconciled:1},worker:null}};},
  useFinanceDirectoryQuery:(...args:unknown[])=>{mocks.directory(...args);return {refetch:vi.fn(),currentData:{items:[{id:'agency-a',name:'Agency A',avatarUrl:null,address:'Đà Nẵng',verified:true,available:'5000000',pending:'0',frozen:'0',requests:'1'}],total:1}};},
  useWalletActionMutation:()=>[mocks.action,{}],
}));
vi.mock('../financeApi',()=>({useFinanceDownloadMutation:()=>[vi.fn(),{}],useFinancePolicyQuery:()=>({currentData:null,refetch:mocks.policyRefresh}),useFinancePolicyHistoryQuery:()=>({currentData:[],refetch:vi.fn()})}));
import AdminFinancePage from '../AdminFinancePage';
vi.mock('../WalletUi',()=>({WithdrawalList:()=>null,WalletSummary:({canWithdraw=false}:{canWithdraw?:boolean})=><div>{canWithdraw&&<button>Yêu cầu rút tiền</button>}</div>}));
beforeEach(()=>{mocks.role='SUPER_ADMIN';mocks.error=false;mocks.dashboard.mockClear();mocks.directory.mockClear();mocks.action.mockReset().mockImplementation(()=>({unwrap:async()=>({data:{records:2,withdrawals:1}})}));});
afterEach(cleanup);
describe('Admin accounting V2',()=>{
  it('opens an actual aggregate dashboard with verified sources selected',()=>{
    render(<AdminFinancePage/>);expect(screen.getByRole('heading',{name:'Kế toán & tài chính'})).toBeTruthy();expect(screen.getByText('Khách thực thu')).toBeTruthy();expect(screen.getByText('Hoa hồng đã ghi nhận')).toBeTruthy();
    expect(mocks.dashboard).toHaveBeenCalledWith(expect.objectContaining({origin:'LIVE'}),expect.anything());
  });
  it('links agency identity cards to dedicated accounting pages',()=>{
    render(<AdminFinancePage/>);fireEvent.click(screen.getByRole('tab',{name:'Agency'}));
    const link=screen.getByRole('link',{name:/Agency A/});expect(link.getAttribute('href')).toBe('/super-admin/finance/agencies/agency-a');expect(screen.getByText('Đà Nẵng')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tên Agency'),{target:{value:'Agency A'}});expect(mocks.directory).toHaveBeenLastCalledWith(expect.objectContaining({q:'Agency A',page:1}),expect.anything());
  });
  it('does not replace an unavailable dashboard with zero balances',()=>{
    mocks.error=true;render(<AdminFinancePage/>);expect(screen.getByText('Không tải được dashboard kế toán.')).toBeTruthy();expect(screen.queryByText('Khách thực thu')).toBeNull();
  });
  it('does not expose the financial workspace to moderators',()=>{
    mocks.role='MODERATOR';render(<AdminFinancePage/>);expect(screen.getByText(/không có quyền truy cập tài chính/)).toBeTruthy();expect(mocks.dashboard).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({skip:true}));
  });
  it('shows the fixed settlement terms without policy editing controls',()=>{render(<AdminFinancePage/>);expect(screen.queryByText(/7 ngày/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Điều kiện quyết toán'}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByText(/7 ngày/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Cấu hình quyết toán'})).toBeNull();expect(screen.queryByRole('button',{name:'Thiết lập chính sách'})).toBeNull();});
});
