import { FIXED_POLICY_ID, FIXED_SETTLEMENT_POLICY } from '../finance.policy';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { startDatabase, stopDatabase, resetDatabase, createUser, createApprovedTour, bearer } from '../../../test/integration';
import { createApp } from '../../../app';
import { completionService } from '../../tour-completion/completion.service';
import { drainFinanceOutbox, reconcileRun, recordRefund, reviewRefund, preparePayout, changePayout, overview, processFinanceJobs, post } from '../finance.service';
import { evaluateSettlement, requestWithdrawal, changeWithdrawal, walletBalances, manualHold } from '../finance.wallet';
import { dashboard } from '../finance.dashboard';
import { exportFinance } from '../finance.export';
import { encryptBank } from '../finance.bank';
import type { PaymentProvider } from '../../payments/providers/payment.provider';
const app = createApp();
beforeAll(startDatabase);
afterAll(stopDatabase);
beforeEach(async()=>{await resetDatabase();await prisma.agencySettlementPolicyVersion.create({data:{id:FIXED_POLICY_ID,effectiveAt:new Date('2000-01-01'),snapshot:FIXED_SETTLEMENT_POLICY,reason:'Fixed product policy'}});});
async function fixture() {
    const owner = await createUser('AGENCY', `agency-${randomUUID()}@test.dev`), traveler = await createUser('TRAVELER', `traveler-${randomUUID()}@test.dev`), admin = await createUser('SUPER_ADMIN', `admin-${randomUUID()}@test.dev`), approver = await createUser('SUPER_ADMIN', `approver-${randomUUID()}@test.dev`);
    const tour = await createApprovedTour(owner.id, { daysAhead: -12, capacity: 10 });
    const departure = (await prisma.tourDeparture.findUniqueOrThrow({ where: { id: tour.departureId } })).date, end = new Date(departure.getTime() + 2 * 86400000);
    const b = await prisma.booking.create({ data: { bookingCode: `FIN-${randomUUID()}`, travelerId: traveler.id, agencyId: owner.id, tourId: tour.tourId, departureId: tour.departureId, tourTitle: 'Tour kiểm tra tài chính', departureDate: departure, endDate: end, participants: 1, contactName: 'Traveler', contactPhone: '0901234567', unitPrice: 10000000n, subtotal: 10000000n, totalAmount: 10000000n, commissionBps: 1000, commissionAmount: 1000000n, agencyAmount: 9000000n, status: 'CONFIRMED', isPaid: true } });
    const p = await prisma.payment.create({ data: { purpose: 'BOOKING', userId: traveler.id, referenceId: b.id, amount: b.totalAmount, currency: 'VND', description: 'payment', provider: 'payos', providerOrderCode: 12345678n, providerPaymentLinkId: 'link-1', status: 'PAID', paidAt: new Date(), expiresAt: new Date() } });
    await prisma.agencyFinancePolicy.create({ data: { holdDays: 0, refundCommissionPolicy: 'PROPORTIONAL', updatedBy: admin.id } });
    await prisma.agencyFinanceBank.create({ data: { agencyId: owner.id, bankName: 'Bank', accountHolder: 'Agency', ...encryptBank(owner.id, { bankName: 'Bank', accountHolder: 'Agency', accountNumber: '1234567890' }), verifiedAt: new Date(), verifiedBy: admin.id, updatedBy: owner.id } });
    await completionService.save({ agencyId: owner.id, userId: owner.id, role: 'AGENCY' }, tour.tourId, tour.departureId, { expectedRevision: 0, actualEndAt: end.toISOString(), summary: 'Chuyến đi đã thực hiện đầy đủ lịch trình dự kiến.', changes: '', incidents: '', evidence: [], amendmentReason: '', attendance: [{ bookingId: b.id, attendedCount: 1 }] }, true);
    const proof = await prisma.agencyFinanceDocument.create({ data: { agencyId: owner.id, actorId: owner.id, name: 'proof.pdf', mimeType: 'application/pdf', data: new Uint8Array(Buffer.from('%PDF-test')), sha256: 'test' } });
    const provider: PaymentProvider = { name: 'payos', async createPaymentLink() { throw new Error('not used'); }, verifyWebhook() { throw new Error('not used'); }, async getPaymentStatus() { return { state: 'PAID', amountPaid: 10000000, paymentLinkId: 'link-1', transactions: [{ reference: 'bank-1', amount: 10000000, currency: 'VND' }] }; } };
    async function reconcile() { await drainFinanceOutbox(); const run = await prisma.agencyReconciliationRun.create({ data: { agencyId: owner.id, actorId: owner.id } }); await reconcileRun(run.id, provider); return run; }
    const start = new Date(Date.now() - 30 * 86400000), finish = new Date(Date.now() + 86400000);
    return { owner, traveler, admin, approver, tour, b, p, proof, provider, reconcile, start, finish };
}
describe('Agency finance, real PostgreSQL', () => {
    it('returns 404 when Admin exports a report for a missing Agency',async()=>{
        const admin=await createUser('SUPER_ADMIN',`export-admin-${randomUUID()}@test.dev`);
        for(const format of ['xlsx','pdf']){
            const result=await request(app).get(`/api/v1/admin/finance/reports/export.${format}`).query({agencyId:randomUUID()}).set(bearer(admin.token));
            expect(result.status).toBe(404);expect(result.body.error.code).toBe('NOT_FOUND');
        }
    });
    it('isolates allowlisted development settlement fixtures from LIVE totals and disables the exception in production',async()=>{
        const f=await fixture();await f.reconcile();
        await prisma.payment.update({where:{id:f.p.id},data:{provider:'TEST-FINANCE'}});
        await prisma.agencyFinanceSource.update({where:{paymentId:f.p.id},data:{origin:'TEST'}});
        const previousIds=env.FINANCE_SANDBOX_AGENCY_IDS,previousMode=env.NODE_ENV;
        try {
            env.FINANCE_SANDBOX_AGENCY_IDS='';
            expect((await evaluateSettlement(f.b.id)).reasons).toContain('TEST_SOURCE');
            env.FINANCE_SANDBOX_AGENCY_IDS=f.owner.id;
            expect((await evaluateSettlement(f.b.id)).reasons).toEqual(['HOLD_PERIOD']);
            expect((await walletBalances(prisma,f.owner.id)).pending).toBe(9000000n);
            env.NODE_ENV='production';
            expect((await evaluateSettlement(f.b.id)).reasons).toContain('TEST_SOURCE');
            expect((await walletBalances(prisma,f.owner.id)).total).toBe(0n);
            env.NODE_ENV='test';
            const result=await request(app).post(`/api/v1/admin/finance/settlements/${f.owner.id}/release-all`).set(bearer(f.admin.token)).send({note:'Exercise sandbox settlement'});
            expect(result.status).toBe(200);expect(result.body.data).toMatchObject({settled:1,skipped:0,totalAmount:'9000000'});
            expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
            const d=await dashboard(f.start,f.finish);expect(d.gmv).toBe(0n);expect(d.balances.available).toBe(0n);
            const again=await request(app).post(`/api/v1/admin/finance/settlements/${f.owner.id}/release-all`).set(bearer(f.admin.token)).send({note:'Exercise sandbox settlement'});
            expect(again.body.data.settled).toBe(0);
        } finally {env.FINANCE_SANDBOX_AGENCY_IDS=previousIds;env.NODE_ENV=previousMode;}
    });
    async function readyWallet() {
        const f=await fixture();await f.reconcile();await prisma.tourCompletion.update({where:{departureId:f.tour.departureId},data:{completedAt:f.b.endDate}});
        return f;
    }
    it('automatically releases once without moving cash and dashboard follows the same journal',async()=>{
        const f=await readyWallet();await Promise.all([evaluateSettlement(f.b.id),evaluateSettlement(f.b.id)]);
        const w=await walletBalances(prisma,f.owner.id);expect(w.pending).toBe(0n);expect(w.available).toBe(9000000n);expect(w.total).toBe(9000000n);
        expect(await prisma.agencyTransaction.count({where:{eventKey:{startsWith:'settlement:'}}})).toBe(1);
        const d=await dashboard(f.start,f.finish);expect(d.gmv).toBe(10000000n);expect(d.paid).toBe(0n);expect(d.released).toBe(9000000n);expect(d.balances.available).toBe(9000000n);expect(d.earnedCommission).toBe(1000000n);
    });
    it('settles an entire Agency across list pages while skipping blocked bookings and keeping other Agencies untouched',async()=>{
        const f=await readyWallet();
        await prisma.tourCompletion.update({where:{departureId:f.tour.departureId},data:{completedAt:new Date()}});
        const original=await evaluateSettlement(f.b.id);expect(original.reasons).toContain('HOLD_PERIOD');
        const other=await createUser('AGENCY',`other-batch-${randomUUID()}@test.dev`);
        const blocked=Array.from({length:27},(_,i)=>({id:randomUUID(),bookingCode:`BATCH-${i}-${randomUUID()}`,travelerId:f.traveler.id,agencyId:i===26?other.id:f.owner.id,tourId:f.tour.tourId,departureId:f.tour.departureId,tourTitle:'Chuyến chưa hoàn tất',departureDate:f.b.departureDate,endDate:f.b.endDate,participants:1,contactName:'Traveler',contactPhone:'0901234567',unitPrice:100n,subtotal:100n,totalAmount:100n,commissionBps:0,commissionAmount:0n,agencyAmount:100n,status:'CONFIRMED' as const,isPaid:false}));
        await prisma.booking.createMany({data:blocked});
        for(const b of blocked)await prisma.$transaction(tx=>post(tx,{agencyId:b.agencyId,bookingId:b.id,bookingCode:b.bookingCode,type:'PAYMENT',amount:100n,eventKey:`batch-test:${b.id}`,effectiveAt:new Date(),description:'Blocked test receipt'},[{account:'PLATFORM_CASH',debit:100n,credit:0n},{account:'AGENCY_PAYABLE',debit:0n,credit:100n}]));
        const url=`/api/v1/admin/finance/settlements/${f.owner.id}/release-all`,body={note:'Quyết toán toàn bộ khoản đủ điều kiện'};
        expect((await request(app).post(url).set(bearer(f.owner.token)).send(body)).status).toBe(403);
        const response=await request(app).post(url).set(bearer(f.admin.token)).send(body);
        expect(response.status).toBe(200);expect(response.body.data).toMatchObject({settled:1,skipped:26,failed:0,totalAmount:'9000000'});
        expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
        expect(await prisma.agencySettlement.count({where:{agencyId:other.id}})).toBe(0);
        const again=await request(app).post(url).set(bearer(f.admin.token)).send(body);expect(again.body.data).toMatchObject({settled:0,skipped:26,totalAmount:'0'});
        expect(await prisma.agencyTransaction.count({where:{eventKey:`settlement:${original.id}`}})).toBe(1);
    });
    it('lets only Admin settle early and posts one release across repeated concurrent requests',async()=>{
        const f=await readyWallet();
        await prisma.tourCompletion.update({where:{departureId:f.tour.departureId},data:{completedAt:new Date()}});
        const row=await evaluateSettlement(f.b.id);expect(row.reasons).toContain('HOLD_PERIOD');
        const url=`/api/v1/admin/finance/settlements/${row.id}/release`,body={note:'Đã kiểm tra hồ sơ, quyết toán sớm'};
        expect((await request(app).post(url).set(bearer(f.owner.token)).send(body)).status).toBe(403);
        const responses=await Promise.all([request(app).post(url).set(bearer(f.admin.token)).send(body),request(app).post(url).set(bearer(f.admin.token)).send(body)]);
        expect(responses.map(r=>r.status)).toEqual([200,200]);
        const after=await prisma.agencySettlement.findUniqueOrThrow({where:{id:row.id}});expect(after.eligibleAt).toEqual(row.eligibleAt);expect(after.releasedAt).not.toBeNull();
        await evaluateSettlement(f.b.id);
        expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
        expect(await prisma.agencyTransaction.count({where:{eventKey:`settlement:${row.id}`}})).toBe(1);
        const audit=await prisma.agencyFinanceAudit.findMany({where:{entityId:row.id,action:'SETTLEMENT_RELEASED'}});
        expect(audit).toHaveLength(1);expect(audit[0]!.actorId).toBe(f.admin.id);expect(audit[0]!.details).toMatchObject({automatic:false,bypassedHold:true,note:body.note});
        expect((await dashboard(f.start,f.finish)).paid).toBe(0n);
    });
    it('does not let early settlement bypass holds, unmatched receipts or test sources',async()=>{
        const f=await readyWallet();
        await prisma.tourCompletion.update({where:{departureId:f.tour.departureId},data:{completedAt:new Date()}});
        const row=await evaluateSettlement(f.b.id),url=`/api/v1/admin/finance/settlements/${row.id}/release`;
        const attempt=()=>request(app).post(url).set(bearer(f.admin.token)).send({note:'Kiểm tra quyết toán sớm'});
        await manualHold(row.id,f.admin.id,true,'Chờ xử lý khiếu nại');expect((await attempt()).status).toBe(409);
        await manualHold(row.id,f.admin.id,false,'Đã xử lý nội dung');
        await prisma.agencyFinanceReceipt.update({where:{paymentId:f.p.id},data:{reconciliationStatus:'DISCREPANCY'}});expect((await attempt()).status).toBe(409);
        await f.reconcile();await prisma.agencyFinanceSource.update({where:{paymentId:f.p.id},data:{origin:'TEST'}});expect((await attempt()).status).toBe(409);
        expect(await prisma.agencyTransaction.count({where:{eventKey:`settlement:${row.id}`}})).toBe(0);
    });
    it('saves bank details through the owner API and rejects stale edits',async()=>{
        const f=await fixture();
        const body={bankName:'Vietcombank',accountHolder:'AGENCY TEST',accountNumber:'1234567890',expectedVersion:1};
        const saved=await request(app).put('/api/v1/agency/finance/bank-account').set(bearer(f.owner.token)).send(body);
        expect(saved.status).toBe(200);
        const account=await request(app).get('/api/v1/agency/finance/bank-account').set(bearer(f.owner.token));
        expect(account.body.data).toMatchObject({bankName:'Vietcombank',last4:'7890',version:2,verifiedAt:null});
        expect(account.body.data.accountNumber).toBeUndefined();
        expect((await request(app).put('/api/v1/agency/finance/bank-account').set(bearer(f.owner.token)).send(body)).status).toBe(409);
    });
    it('enforces the withdrawal capability through actual API and preserves the ledger export total',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);
        const member=await createUser('TRAVELER',`accountant-${randomUUID()}@test.dev`),role=await prisma.agencyRole.findFirstOrThrow({where:{agencyId:f.owner.id,systemRole:'ACCOUNTANT'}});
        await prisma.agencyMember.create({data:{agencyId:f.owner.id,userId:member.id,role:'ACCOUNTANT',roleId:role.id}});
        const input={amount:'4000000',requestKey:randomUUID()};
        expect((await request(app).post('/api/v1/agency/finance/withdrawals').set(bearer(member.token)).set('X-Agency-Id',f.owner.id).send(input)).status).toBe(403);
        const response=await request(app).post('/api/v1/agency/finance/withdrawals').set(bearer(f.owner.token)).send(input);expect(response.status).toBe(200);
        const bytes=await exportFinance(f.owner.id,f.start,f.finish,'xlsx','LIVE');const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes as never);
        const sheet=wb.getWorksheet('Tổng hợp')!;const values:Record<string,unknown>={};sheet.eachRow(row=>{values[String(row.getCell(1).value)]=row.getCell(2).value;});
        expect(values['Phải trả agency cuối kỳ']).toBe(9000000);expect(values['Đã giải phóng vào số dư']).toBe(9000000);
        const adminData=await request(app).get('/api/v1/admin/finance/dashboard').set(bearer(f.admin.token));expect(adminData.status).toBe(200);expect(adminData.body.data.tasks.pending).toBe(1);
        expect((await request(app).get('/api/v1/admin/finance/directory').set(bearer(f.admin.token))).body.data.total).toBe(1);
        const settlement=await prisma.agencySettlement.findUniqueOrThrow({where:{bookingId:f.b.id}});
        const source=await request(app).get(`/api/v1/admin/finance/settlement-source/${settlement.id}`).set(bearer(f.admin.token));
        expect(source.status).toBe(200);expect(source.body.data.booking.bookingCode).toBe(f.b.bookingCode);expect(source.body.data.receipts[0].reconciliationStatus).toBe('MATCHED');expect(source.body.data.report.revision).toBeGreaterThan(0);
        expect((await request(app).get(`/api/v1/admin/finance/settlement-source/${settlement.id}`).set(bearer(f.owner.token))).status).toBe(403);
    });
    it('preserves manual holds without bypassing independent source checks on release',async()=>{
        const f=await readyWallet();const s=await evaluateSettlement(f.b.id);await manualHold(s.id,f.admin.id,true,'Kiểm tra chất lượng dịch vụ');expect((await walletBalances(prisma,f.owner.id)).frozen).toBe(9000000n);
        await prisma.agencyFinanceReceipt.update({where:{paymentId:f.p.id},data:{reconciliationStatus:'DISCREPANCY'}});
        await manualHold(s.id,f.admin.id,false,'Đã xử lý nội dung kiểm tra');expect((await walletBalances(prisma,f.owner.id)).available).toBe(0n);
        await f.reconcile();await evaluateSettlement(f.b.id);expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
    });
    it('blocks bank changes during withdrawal processing',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);const w=await requestWithdrawal(f.owner.id,f.owner.id,'4000000',randomUUID());await changeWithdrawal(w.id,f.admin.id,'approve');await changeWithdrawal(w.id,f.admin.id,'process');
        await prisma.agencyFinanceBank.update({where:{agencyId:f.owner.id},data:{version:{increment:1},verifiedAt:null}});
        await expect(changeWithdrawal(w.id,f.admin.id,'complete',{amount:'4000000',bankRef:'changed-bank',proofId:f.proof.id,transferredAt:new Date().toISOString()})).rejects.toThrow();
        expect((await walletBalances(prisma,f.owner.id)).reserved).toBe(4000000n);
    });
    it('captures timing policy once rather than restarting it on policy edits',async()=>{
        const f=await readyWallet();await prisma.tourCompletion.update({where:{departureId:f.tour.departureId},data:{completedAt:new Date()}});const first=await evaluateSettlement(f.b.id);expect(first.releasedAt).toBeNull();
        await prisma.agencyFinancePolicy.update({where:{id:'default'},data:{holdDays:0}});
        const second=await evaluateSettlement(f.b.id);expect(second.eligibleAt).toEqual(first.eligibleAt);expect(second.releasedAt).toBeNull();expect(second.reasons).toContain('HOLD_PERIOD');
    });
    it('reserves concurrent withdrawals atomically and preserves submission idempotency',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);const key=randomUUID();
        const results=await Promise.allSettled([requestWithdrawal(f.owner.id,f.owner.id,'6000000',key),requestWithdrawal(f.owner.id,f.owner.id,'6000000',randomUUID())]);
        expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
        const saved=await prisma.agencyWithdrawal.findFirstOrThrow();await requestWithdrawal(f.owner.id,f.owner.id,'6000000',saved.requestKey);
        expect(await prisma.agencyWithdrawal.count()).toBe(1);const balances=await walletBalances(prisma,f.owner.id);expect(balances.available).toBe(3000000n);expect(balances.reserved).toBe(6000000n);
    });
    it('runs withdrawal approval, transfer proof and exact cash posting with tenant isolation',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);const w=await requestWithdrawal(f.owner.id,f.owner.id,'4000000',randomUUID());
        await expect(changeWithdrawal(w.id,f.owner.id,'approve')).rejects.toThrow();
        const other=await createUser('AGENCY',`wallet-other-${randomUUID()}@test.dev`);
        expect((await request(app).post(`/api/v1/agency/finance/withdrawals/${w.id}/cancel`).set(bearer(other.token))).status).toBe(404);
        await changeWithdrawal(w.id,f.admin.id,'approve');await changeWithdrawal(w.id,f.approver.id,'process');
        const input={amount:'4000000',bankRef:'withdrawal-real-proof-test',proofId:f.proof.id,transferredAt:new Date().toISOString()};
        await expect(changeWithdrawal(w.id,f.admin.id,'complete',input)).rejects.toThrow();
        await expect(changeWithdrawal(w.id,f.approver.id,'complete',{...input,amount:'5000000'})).rejects.toThrow();
        await changeWithdrawal(w.id,f.approver.id,'complete',input);
        await expect(changeWithdrawal(w.id,f.approver.id,'complete',input)).rejects.toThrow();
        const balances=await walletBalances(prisma,f.owner.id);expect(balances.available).toBe(5000000n);expect(balances.reserved).toBe(0n);
        const d=await dashboard(f.start,f.finish);expect(d.paid).toBe(4000000n);expect(d.released).toBe(9000000n);
        expect(await prisma.notification.count({where:{type:'FINANCE_SETTLED'}})).toBeGreaterThan(0);
    });
    it('keeps unknown transfer outcomes reserved and requires evidence to release a failed transfer',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);const w=await requestWithdrawal(f.owner.id,f.owner.id,'4000000',randomUUID());
        await changeWithdrawal(w.id,f.admin.id,'approve');await changeWithdrawal(w.id,f.admin.id,'process');
        await evaluateSettlement(f.b.id,new Date(Date.now()+10*86400000));expect((await walletBalances(prisma,f.owner.id)).reserved).toBe(4000000n);
        await expect(changeWithdrawal(w.id,f.admin.id,'fail',{note:'Đã kiểm tra thất bại'})).rejects.toThrow();
        await expect(changeWithdrawal(w.id,f.approver.id,'fail',{note:'Không phải người nhận xử lý',bankRef:'wrong-processor',proofId:f.proof.id,transferredAt:new Date().toISOString()})).rejects.toThrow();
        await changeWithdrawal(w.id,f.admin.id,'fail',{note:'Đã kiểm tra không chuyển thành công',bankRef:'failed-wallet-test',proofId:f.proof.id,transferredAt:new Date().toISOString()});
        expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
    });
    it('freezes a released balance on source changes and rechecks reserved requests before transfer',async()=>{
        const f=await readyWallet();await evaluateSettlement(f.b.id);const w=await requestWithdrawal(f.owner.id,f.owner.id,'4000000',randomUUID());
        await prisma.agencyFinanceReceipt.update({where:{paymentId:f.p.id},data:{reconciliationStatus:'DISCREPANCY'}});await evaluateSettlement(f.b.id);
        const balances=await walletBalances(prisma,f.owner.id);expect(balances.available).toBe(0n);expect(balances.frozen).toBe(5000000n);expect(balances.reserved).toBe(4000000n);
        await expect(changeWithdrawal(w.id,f.admin.id,'approve')).rejects.toThrow();
        await changeWithdrawal(w.id,f.owner.id,'cancel',{},f.owner.id);expect((await walletBalances(prisma,f.owner.id)).frozen).toBe(9000000n);
        await f.reconcile();await evaluateSettlement(f.b.id);expect((await walletBalances(prisma,f.owner.id)).available).toBe(9000000n);
        expect(await prisma.agencyTransaction.count({where:{eventKey:{startsWith:'settlement:'}}})).toBe(1);
    });
    it('does not promote explicit test sources or credit historical payouts twice',async()=>{
        const f=await readyWallet();await prisma.agencyFinanceSource.update({where:{paymentId:f.p.id},data:{origin:'TEST'}});await f.reconcile();await evaluateSettlement(f.b.id);
        expect((await walletBalances(prisma,f.owner.id)).available).toBe(0n);expect((await dashboard(f.start,f.finish)).gmv).toBe(0n);expect((await dashboard(f.start,f.finish,'TEST')).gmv).toBe(10000000n);
    });
    it('does not release amounts already reserved or paid by legacy settlement periods',async()=>{
        const f=await readyWallet();const old=await preparePayout(f.owner.id,f.admin.id,f.start,f.finish);await changePayout(old.id,f.approver.id,'approve');await changePayout(old.id,f.admin.id,'complete',{bankRef:'legacy-before-wallet',proofId:f.proof.id});
        const s=await evaluateSettlement(f.b.id);expect(s.releasedAt).toBeNull();expect(s.reasons).toContain('LEGACY_RESERVATION');expect((await walletBalances(prisma,f.owner.id)).available).toBe(0n);
    });
    it('defers accounting refunds and rejects editing the fixed settlement policy', async () => {
        const f = await fixture();
        const deferred=await request(app).get('/api/v1/agency/finance/refunds').set(bearer(f.owner.token));
        expect(deferred.status).toBe(501);expect(deferred.body.error.code).toBe('FINANCE_REFUNDS_NOT_IMPLEMENTED');
        expect((await request(app).post(`/api/v1/agency/finance/refunds/${f.b.id}/manual-payments`).set(bearer(f.owner.token)).send({})).status).toBe(501);
        expect((await request(app).post(`/api/v1/admin/finance/refunds/${f.b.id}/review`).set(bearer(f.admin.token)).send({})).status).toBe(501);
        const before = await request(app).get('/api/v1/admin/finance/policy').set(bearer(f.admin.token));
        const input = { holdDays: 7, expectedUpdatedAt: before.body.data.updatedAt };
        const saved = await request(app).put('/api/v1/admin/finance/policy').set(bearer(f.admin.token)).send(input);
        expect(saved.status).toBe(409);
        expect(before.body.data.holdDays).toBe(7);expect(before.body.data.autoSettlement).toBe(true);expect(before.body.data.fixed).toBe(true);
        expect((await request(app).put('/api/v1/admin/finance/policy').set(bearer(f.admin.token)).send(input)).status).toBe(409);
        expect((await request(app).put('/api/v1/admin/finance/policy').set(bearer(f.owner.token)).send(input)).status).toBe(403);
        const history = await request(app).get('/api/v1/admin/finance/policy/history').set(bearer(f.admin.token));
        expect(history.body.data).toEqual([]);
        const stats = await request(app).get('/api/v1/agency/finance/overview').set(bearer(f.owner.token));
        expect(stats.body.data.settlementPolicy.holdDays).toBe(7);
    });
    it('runs the scheduled finance worker repeatedly on an empty database',async()=>{
      await processFinanceJobs();await processFinanceJobs();expect(await prisma.agencyTransaction.count()).toBe(0);
    });
    it('discovers paid receipts transactionally and never pays unreconciled cash', async () => {
        const f = await fixture();
        expect(await prisma.financeOutbox.count()).toBe(1);
        await Promise.all([drainFinanceOutbox(), drainFinanceOutbox()]);
        expect(await prisma.agencyTransaction.count()).toBe(1);
        expect((await overview(f.owner.id, f.start, f.finish)).available).toBe(0n);
        await f.reconcile();
        await f.reconcile();
        expect(await prisma.agencyTransaction.count()).toBe(1);
        expect((await overview(f.owner.id, f.start, f.finish)).available).toBe(9000000n);
    });
    it('distinguishes aggregate PAID from independent transaction evidence and preserves mismatches', async () => {
        const f = await fixture();
        await drainFinanceOutbox();
        const run = await prisma.agencyReconciliationRun.create({ data: { agencyId: f.owner.id, actorId: f.owner.id } });
        await reconcileRun(run.id, { ...f.provider, async getPaymentStatus() { return { state: 'PAID', amountPaid: 10000000, paymentLinkId: 'link-1' }; } });
        expect((await prisma.agencyFinanceReceipt.findUniqueOrThrow({ where: { paymentId: f.p.id } })).reconciliationStatus).toBe('UNRECONCILED');
        const run2 = await prisma.agencyReconciliationRun.create({ data: { agencyId: f.owner.id, actorId: f.owner.id } });
        await reconcileRun(run2.id, { ...f.provider, async getPaymentStatus() { return { state: 'PAID', amountPaid: 11000000, paymentLinkId: 'link-1', transactions: [{ reference: 'bank-excess', amount: 11000000, currency: 'VND' }] }; } });
        expect((await prisma.agencyFinanceReceipt.findUniqueOrThrow({ where: { paymentId: f.p.id } })).reconciliationStatus).toBe('DISCREPANCY');
        expect(await prisma.agencyGatewayObservation.count()).toBe(2);
        expect((await overview(f.owner.id, f.start, f.finish)).gmv).toBe(10000000n);
    });
    it('credits agency-funded refunds rather than charging the agency twice; prevents duplicate and excess claims', async () => {
        const f = await fixture();
        await f.reconcile();
        await prisma.booking.update({ where: { id: f.b.id }, data: { refundRequired: true, refundAmount: 2000000 } });
        const input = { amount: '2000000', paidBy: 'AGENCY' as const, transferredAt: new Date(Date.now() - 1000).toISOString(), bankRef: 'agency-refund-1', proofId: f.proof.id, reason: 'Hoàn tiền theo quyết định', requestKey: randomUUID() };
        const r = await recordRefund(f.owner.id, f.owner.id, f.b.id, input);
        expect((await recordRefund(f.owner.id, f.owner.id, f.b.id, input)).id).toBe(r.id);
        await expect(recordRefund(f.owner.id, f.owner.id, f.b.id, { ...input, requestKey: randomUUID(), bankRef: 'another' })).rejects.toThrow();
        await expect(reviewRefund(r.id, f.owner.id, true, 'Đã kiểm tra')).rejects.toThrow();
        await reviewRefund(r.id, f.admin.id, true, 'Đã kiểm tra chứng từ');
        const stats = await overview(f.owner.id, f.start, f.finish);
        expect(stats.held).toBe(9200000n);
        expect(stats.available).toBe(9200000n);
        expect(stats.refundLiability).toBe(0n);
        expect(stats.commission).toBe(800000n);
        expect(stats.agencyEntitlement).toBe(7200000n);
    });
    it('platform-funded partial refunds reduce agency payable only by its allocation', async () => {
        const f = await fixture();
        await f.reconcile();
        await prisma.booking.update({ where: { id: f.b.id }, data: { refundRequired: true, refundAmount: 2000000 } });
        for (let i = 0; i < 2; i++) {
            const r = await recordRefund(f.owner.id, f.owner.id, f.b.id, { amount: '1000000', paidBy: 'PLATFORM', transferredAt: new Date(Date.now() - 1000).toISOString(), bankRef: `platform-refund-${i}`, proofId: f.proof.id, reason: 'Hoàn một phần', requestKey: randomUUID() });
            await reviewRefund(r.id, f.admin.id, true, 'Chứng từ hợp lệ');
        }
        expect((await overview(f.owner.id, f.start, f.finish)).held).toBe(7200000n);
    });
    it('reserves money once across concurrent periods; only completed external transfer decreases payable', async () => {
        const f = await fixture();
        await f.reconcile();
        const result = await Promise.allSettled([preparePayout(f.owner.id, f.admin.id, f.start, f.finish), preparePayout(f.owner.id, f.admin.id, f.start, f.finish)]);
        expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const p = await prisma.agencyPayout.findFirstOrThrow();
        expect((await overview(f.owner.id, f.start, f.finish)).held).toBe(9000000n);
        await expect(changePayout(p.id, f.admin.id, 'approve')).rejects.toThrow();
        await changePayout(p.id, f.approver.id, 'approve');
        await expect(changePayout(p.id, f.admin.id, 'complete')).rejects.toThrow();
        await changePayout(p.id, f.admin.id, 'complete', { bankRef: 'external-payout-1', proofId: f.proof.id });
        await expect(changePayout(p.id, f.admin.id, 'complete', { bankRef: 'external-payout-1', proofId: f.proof.id })).rejects.toThrow();
        expect((await overview(f.owner.id, f.start, f.finish)).held).toBe(0n);
    });
    it('releases a failed external transfer only with documented confirmation and does not post cash', async () => {
        const f = await fixture();
        await f.reconcile();
        const p = await preparePayout(f.owner.id, f.admin.id, f.start, f.finish);
        await changePayout(p.id, f.approver.id, 'approve');
        await expect(changePayout(p.id, f.admin.id, 'fail')).rejects.toThrow();
        await changePayout(p.id, f.admin.id, 'fail', { bankRef: 'failed-bank-transfer', proofId: f.proof.id });
        expect((await overview(f.owner.id, f.start, f.finish)).available).toBe(9000000n);
        expect(await prisma.agencyTransaction.count({ where: { type: 'PAYOUT' } })).toBe(0);
    });
    it('offsets debt from a refund after payout against other bookings without rewriting the paid period', async () => {
        const f = await fixture();
        await f.reconcile();
        const p = await preparePayout(f.owner.id, f.admin.id, f.start, f.finish);
        await changePayout(p.id, f.approver.id, 'approve');
        await changePayout(p.id, f.admin.id, 'complete', { bankRef: 'paid-period', proofId: f.proof.id });
        await prisma.booking.update({ where: { id: f.b.id }, data: { refundRequired: true, refundAmount: 2000000n } });
        const refund = await recordRefund(f.owner.id, f.owner.id, f.b.id, { amount: '2000000', paidBy: 'PLATFORM', transferredAt: new Date(Date.now() - 1000).toISOString(), bankRef: 'refund-after-period', proofId: f.proof.id, reason: 'Hoàn sau quyết toán', requestKey: randomUUID() });
        await reviewRefund(refund.id, f.admin.id, true, 'Chứng từ chuyển đã xác minh');
        const { id: _id, bookingCode: _code, createdAt: _created, updatedAt: _updated, serviceSnapshot: _services, guestPricing: _pricing, passengerSnapshot: _passengers, cancellationPolicySnapshot: _cancellation, ...data } = f.b;
        const second = await prisma.booking.create({ data: { ...data, bookingCode: `FIN-${randomUUID()}`, status: 'COMPLETED', completedAt: new Date() } });
        await prisma.payment.create({ data: { purpose: 'BOOKING', userId: f.traveler.id, referenceId: second.id, amount: 10000000n, currency: 'VND', description: 'second', provider: 'payos', providerOrderCode: 87654321n, providerPaymentLinkId: 'link-1', status: 'PAID', paidAt: new Date(), expiresAt: new Date() } });
        await f.reconcile();
        const stats = await overview(f.owner.id, f.start, f.finish);
        expect(stats.available).toBe(7200000n);
        expect(stats.held).toBe(7200000n);
        expect((await prisma.agencyPayout.findUniqueOrThrow({ where: { id: p.id } })).netPayoutAmount).toBe(9000000n);
    });
    it('enforces tenant and role scope for documents, bank data, admin APIs and finance entry', async () => {
        const f = await fixture(), other = await createUser('AGENCY', `other-${randomUUID()}@test.dev`), moderator = await createUser('MODERATOR', `mod-${randomUUID()}@test.dev`);
        expect((await request(app).get('/api/v1/agency/finance/overview').set(bearer(f.owner.token))).status).toBe(200);
        expect((await request(app).get(`/api/v1/agency/finance/documents/${f.proof.id}`).set(bearer(other.token))).status).toBe(404);
        expect((await request(app).get('/api/v1/admin/finance/agencies').set(bearer(moderator.token))).status).toBe(403);
        const bank = await request(app).get('/api/v1/agency/finance/bank-account').set(bearer(f.owner.token));
        expect(bank.status).toBe(200);
        expect(JSON.stringify(bank.body)).not.toContain('encryptedDetails');
        expect(JSON.stringify(bank.body)).not.toContain('1234567890');
    });
    it('rejects unbalanced or rewritten journals in the database and exports exact workbook totals', async () => {
        const f = await fixture();
        await f.reconcile();
        await expect(prisma.agencyTransaction.create({ data: { agencyId: f.owner.id, type: 'PAYMENT', amount: 1n, eventKey: 'unbalanced', effectiveAt: new Date(), description: 'bad' } })).rejects.toThrow();
        const existing = await prisma.agencyTransaction.findFirstOrThrow();
        await expect(prisma.agencyTransaction.update({ where: { id: existing.id }, data: { amount: 100n } })).rejects.toThrow();
        await expect(prisma.$transaction(async (tx) => { await tx.agencyLedgerEntry.createMany({ data: [{ transactionId: existing.id, account: 'PLATFORM_CASH', debit: 1n, credit: 0n }, { transactionId: existing.id, account: 'AGENCY_PAYABLE', debit: 0n, credit: 1n }] }); })).rejects.toThrow();
        const bytes = await exportFinance(f.owner.id, f.start, f.finish, 'xlsx');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(bytes as never);
        expect(wb.getWorksheet('Giao dịch')?.getCell('D2').value).toBe(10000000);
        expect(wb.getWorksheet('Giao dịch')?.getCell('D3').value).toEqual({ formula: 'SUM(D2:D2)', result: 10000000 });
        const pdf = await exportFinance(f.owner.id, f.start, f.finish, 'pdf');
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });
});
