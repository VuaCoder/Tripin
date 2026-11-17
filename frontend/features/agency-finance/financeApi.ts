import { baseApi } from '@/store/api/baseApi';
export type Period = {
    period: 'week' | 'month' | 'quarter' | 'custom';
    from?: string;
    to?: string;
};
export type Page<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
};
export interface Overview {
    settlementPolicy?: Pick<SettlementPolicy, 'holdDays' | 'updatedAt'> | null;
    gmv: string;
    commission: string;
    agencyEntitlement: string;
    held: string;
    available: string;
    paidOut: string;
    openingBalance: string;
    closingBalance: string;
    refundLiability: string;
    unresolvedReceipts: number;
    policyConfigured: boolean;
    cashflow: {
        date: string;
        receipts: string;
        refunds: string;
        commission: string;
    }[];
}
export interface Journal {
    id: string;
    bookingCode: string | null;
    type: string;
    amount: string;
    effectiveAt: string;
    description: string;
    entries: {
        account: string;
        debit: string;
        credit: string;
    }[];
}
export interface Receipt {
    paymentId: string;
    amount: string;
    actualAmount: string;
    reconciliationStatus: string;
    reason: string | null;
    gatewayRef: string | null;
    checkedAt: string | null;
    booking: {
        bookingCode: string;
        tourTitle: string;
    };
    payment: {
        provider: string;
        providerOrderCode: string;
    };
}
export interface ManualRefund {
    id: string;
    bookingId: string;
    amount: string;
    paidBy: string;
    bankRef: string;
    proofId: string;
    transferredAt: string;
    status: string;
    reason: string;
    reviewNote: string | null;
    actorId: string | null;
    booking?: {
        bookingCode: string;
    };
}
export interface RefundBooking {
    id: string;
    bookingCode: string;
    tourTitle: string;
    approvedAmount: string;
    recordedAmount: string;
    confirmedAmount: string;
    financeRefunds: ManualRefund[];
}
export interface Payout {
    id: string;
    status: string;
    netPayoutAmount: string;
    totalGmv: string;
    platformCommission: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
    completedAt: string | null;
    bankRef: string | null;
    proofId: string | null;
    preparedBy: string;
    bankSnapshot: {
        bankName: string;
        accountHolder: string;
        last4: string;
        version: number;
    };
    items: {
        id: string;
        amount: string;
        booking: {
            bookingCode: string;
        };
    }[];
}
export interface Bank {
    bankName: string;
    accountHolder: string;
    last4: string;
    version: number;
    verifiedAt: string | null;
}
export interface Run {
    id: string;
    status: string;
    checked: number;
    matched: number;
    discrepancies: number;
    errors: number;
    createdAt: string;
}
export interface Agency {
    id: string;
    companyName: string | null;
    verificationStatus: string;
}
export interface AdminDetail {
    summary: Overview;
    payouts: Payout[];
    bank: Bank | null;
    audit: {
        id: string;
        action: string;
        actorId: string | null;
        createdAt: string;
    }[];
}
export interface SettlementPolicy { holdDays: number; updatedAt: string; autoSettlement?:boolean;minWithdrawal?:string;maxWithdrawal?:string;dailyWithdrawalLimit?:string;processingHours?:number;effectiveAt?:string; }
export interface PolicyHistory {
    id: string; actorId: string | null; actorName?: string; createdAt: string;
    details: { holdDays?: number; before?: { holdDays: number } | null; after?: { holdDays: number } };
}
export const financeApi = baseApi.enhanceEndpoints({ addTagTypes: ['AgencyFinance'] }).injectEndpoints({ endpoints: b => ({
        financeOverview: b.query<Overview, {
            agencyId: string;
            range: Period;
        }>({ query: a => ({ url: '/agency/finance/overview', params: a.range }), transformResponse: (r: {
                data: Overview;
            }) => r.data }),
        financeJournals: b.query<Page<Journal>, {
            agencyId: string;
            range: Period;
            page: number;
            search: string;
            type?: string;
        }>({ query: a => ({ url: '/agency/finance/transactions', params: { ...a.range, page: a.page, search: a.search, type: a.type || undefined } }), transformResponse: (r: {
                data: Page<Journal>;
            }) => r.data }),
        financeReceipts: b.query<Page<Receipt>, {
            agencyId: string;
            range: Period;
            page: number;
            search: string;
            reconciliationStatus?: string;
        }>({ query: a => ({ url: '/agency/finance/receipts', params: { ...a.range, page: a.page, search: a.search, reconciliationStatus: a.reconciliationStatus || undefined } }), transformResponse: (r: {
                data: Page<Receipt>;
            }) => r.data }),
        financeRefunds: b.query<RefundBooking[], string>({ query: () => '/agency/finance/refunds', transformResponse: (r: {
                data: RefundBooking[];
            }) => r.data }),
        financePayouts: b.query<Page<Payout>, {
            agencyId: string;
            range: Period;
            page: number;
        }>({ query: a => ({ url: '/agency/finance/payouts', params: { ...a.range, page: a.page } }), transformResponse: (r: {
                data: Page<Payout>;
            }) => r.data }),
        financeBank: b.query<Bank | null, string>({ providesTags: ['AgencyFinance'], query: () => '/agency/finance/bank-account', transformResponse: (r: {
                data: Bank | null;
            }) => r.data }),
        financeRuns: b.query<Run[], string>({ query: () => '/agency/finance/reconcile/runs', transformResponse: (r: {
                data: Run[];
            }) => r.data }),
        saveFinanceBank: b.mutation<{ data: { saved: boolean } }, { bankName: string; accountHolder: string; accountNumber: string; expectedVersion: number }>({
            query: body => ({ url: '/agency/finance/bank-account', method: 'PUT', body }),
            invalidatesTags: (_result, error) => error ? [] : ['AgencyFinance'],
        }),
        financeAction: b.mutation<{
            data: unknown;
        }, {
            url: string;
            body?: unknown;
            method?: 'POST' | 'PUT';
        }>({ query: a => ({ url: a.url, method: a.method ?? 'POST', body: a.body }) }),
        financeUpload: b.mutation<{
            data: {
                id: string;
                name: string;
            };
        }, {
            url: string;
            file: File;
        }>({ query: a => { const body = new FormData(); body.append('file', a.file); return { url: a.url, method: 'POST', body }; } }),
        financeDownload: b.mutation<{
            downloadUrl: string;
            extension: string;
        }, {
            url: string;
            params?: Period & { agencyId?: string; origin?: 'LIVE' | 'TEST' | 'UNKNOWN' };
        }>({ query: a => ({ url: a.url, params: a.params, responseHandler: async (r) => {
            if(!r.ok)return r.json();
            const blob=await r.blob();
            const extension=({'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx'} as Record<string,string>)[blob.type]??'bin';
            return {downloadUrl:URL.createObjectURL(blob),extension};
        } }) }),
        financeAgencies: b.query<Agency[], void>({ query: () => '/admin/finance/agencies', transformResponse: (r: {
                data: Agency[];
            }) => r.data }),
        financeAdminDetail: b.query<AdminDetail, {
            agencyId: string;
            range: Period;
        }>({ query: a => ({ url: `/admin/finance/agencies/${a.agencyId}`, params: a.range }), transformResponse: (r: {
                data: AdminDetail;
            }) => r.data }),
        financePolicy: b.query<SettlementPolicy | null, void>({ query: () => '/admin/finance/policy', transformResponse: (r: { data: SettlementPolicy | null }) => r.data }),
        financePolicyHistory: b.query<PolicyHistory[], void>({ query: () => '/admin/finance/policy/history', transformResponse: (r: { data: PolicyHistory[] }) => r.data }),
        financeAdminBank: b.mutation<{
            data: {
                bankName: string;
                accountHolder: string;
                accountNumber: string;
                version: number;
            };
        }, string>({ query: agencyId => ({ url: `/admin/finance/agencies/${agencyId}/bank-details` }) }),
    }) });
export const { useSaveFinanceBankMutation, useFinanceOverviewQuery, useFinanceJournalsQuery, useFinanceReceiptsQuery, useFinanceRefundsQuery, useFinancePayoutsQuery, useFinanceBankQuery, useFinanceRunsQuery, useFinanceActionMutation, useFinanceUploadMutation, useFinanceDownloadMutation, useFinanceAgenciesQuery, useFinanceAdminDetailQuery, useFinancePolicyQuery, useFinancePolicyHistoryQuery, useFinanceAdminBankMutation } = financeApi;
