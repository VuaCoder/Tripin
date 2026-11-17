import { exportDashboardReport } from './finance.dashboard.export';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { userActor } from '../../middlewares/authorize';
import { agencyContext, requireAgencyPermission } from '../../middlewares/agency-context';
import { validate } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { AGENCY_PERMISSIONS as P } from '../agencies/agency.policy';
import { jsonMoney, periodRange } from './finance.rules';
import { walletBalances, requestWithdrawal, changeWithdrawal, settlementRows, withdrawalRows, processSettlements, manualHold, settleNow, settleAgencyNow } from './finance.wallet';
import { dashboard, agencyDirectory } from './finance.dashboard';
import { auditFinance } from './finance.service';
import { exportFinance } from './finance.export';
import { createRateLimiter } from '../../middlewares/rate-limit';
const limited = createRateLimiter({ windowMs:60000,limit:20 });
const id = z.string().uuid();
const pageQuery = z.object({ page:z.coerce.number().int().min(1).max(100000).default(1),status:z.enum(['PENDING','APPROVED','PROCESSING','COMPLETED','REJECTED','CANCELLED','FAILED']).optional(),agencyId:id.optional(),overdue:z.enum(['true','false']).optional() });
const actionBody = z.object({ amount:z.string().regex(/^[1-9]\d{0,15}$/).optional(),note:z.string().trim().min(3).max(1000).optional(),bankRef:z.string().trim().min(3).max(150).optional(),proofId:id.optional(),transferredAt:z.iso.datetime().optional() }).strict();
const range = z.object({ period:z.enum(['week','month','quarter','custom']).default('month'),from:z.string().optional(),to:z.string().optional(),origin:z.enum(['LIVE','TEST','UNKNOWN']).default('LIVE'),agencyId:id.optional() });
const ok = (res:Parameters<typeof sendOk>[0],data:unknown) => sendOk(res,jsonMoney(data));
export const agencyWalletRouter=Router(),adminWalletRouter=Router();
agencyWalletRouter.get('/balances',async(req,res)=>ok(res,await walletBalances(prisma,agencyContext(req).agencyId)));
agencyWalletRouter.get('/settlements',validate({query:pageQuery}),async(req,res)=>ok(res,await settlementRows(agencyContext(req).agencyId,pageQuery.parse(req.query).page)));
agencyWalletRouter.get('/withdrawals',validate({query:pageQuery}),async(req,res)=>{const q=pageQuery.parse(req.query);ok(res,await withdrawalRows(agencyContext(req).agencyId,q.page,q.status));});
agencyWalletRouter.post('/withdrawals',requireAgencyPermission(P.FINANCE_WITHDRAW),limited,validate({body:z.object({amount:z.string().regex(/^[1-9]\d{0,15}$/),requestKey:id}).strict()}),async(req,res)=>{
  const ctx=agencyContext(req);ok(res,await requestWithdrawal(ctx.agencyId,ctx.actorUserId,req.body.amount,req.body.requestKey,ctx));
});
agencyWalletRouter.post('/withdrawals/:id/cancel',requireAgencyPermission(P.FINANCE_WITHDRAW),limited,validate({params:z.object({id})}),async(req,res)=>{
  const ctx=agencyContext(req);ok(res,await changeWithdrawal(id.parse(req.params.id),ctx.actorUserId,'cancel',{},ctx.agencyId,ctx));
});
adminWalletRouter.get('/dashboard',validate({query:range}),async(req,res)=>{const q=range.parse(req.query),r=periodRange(q.period,q.from,q.to);ok(res,await dashboard(r.start,r.end,q.origin,q.agencyId));});
adminWalletRouter.get('/directory',validate({query:z.object({q:z.string().trim().max(100).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),filter:z.enum(['ALL','BALANCE','WITHDRAWALS','FROZEN','UNVERIFIED_BANK']).default('ALL'),origin:z.enum(['LIVE','TEST','UNKNOWN']).default('LIVE')})}),async(req,res)=>{
  const q=z.object({q:z.string().default(''),page:z.coerce.number().default(1),filter:z.string().default('ALL'),origin:z.enum(['LIVE','TEST','UNKNOWN']).default('LIVE')}).parse(req.query);ok(res,await agencyDirectory(q.q,q.page,q.filter,q.origin));
});
adminWalletRouter.get('/wallet/:agencyId',validate({params:z.object({agencyId:id})}),async(req,res)=>ok(res,await walletBalances(prisma,id.parse(req.params.agencyId))));
adminWalletRouter.get('/directory/:agencyId',validate({params:z.object({agencyId:id})}),async(req,res)=>{
  const a=await prisma.agencyProfile.findUnique({where:{id:id.parse(req.params.agencyId)},select:{id:true,companyName:true,address:true,verificationStatus:true,user:{select:{avatarUrl:true}}}});
  if(!a)throw AppError.notFound();ok(res,{id:a.id,name:a.companyName??'Agency',address:a.address,verified:a.verificationStatus==='VERIFIED',avatarUrl:a.user?.avatarUrl??null});
});
adminWalletRouter.get('/settlements/:agencyId',validate({params:z.object({agencyId:id}),query:pageQuery}),async(req,res)=>ok(res,await settlementRows(id.parse(req.params.agencyId),pageQuery.parse(req.query).page)));
adminWalletRouter.get('/settlement-source/:id',validate({params:z.object({id})}),async(req,res)=>{
  const settlement=await prisma.agencySettlement.findUnique({where:{id:id.parse(req.params.id)}});if(!settlement)throw AppError.notFound();
  const b=await prisma.booking.findUniqueOrThrow({where:{id:settlement.bookingId},select:{id:true,bookingCode:true,tourTitle:true,departureDate:true,endDate:true,totalAmount:true,commissionAmount:true,agencyAmount:true,departureId:true}});
  const c=await prisma.tourCompletion.findUnique({where:{departureId:b.departureId}});
  const report=c?await prisma.tourCompletionReport.findFirst({where:{completionId:c.id,submitted:true},orderBy:{revision:'desc'}}):null;
  const payload=report?.payload as {summary?:string}|undefined;
  const author=report?await prisma.user.findUnique({where:{id:report.actorId},select:{fullName:true}}):null;
  const receipts=await prisma.agencyFinanceReceipt.findMany({where:{bookingId:b.id},select:{paymentId:true,amount:true,actualAmount:true,reconciliationStatus:true,gatewayRef:true,checkedAt:true}});
  await auditFinance(prisma,settlement.agencyId,userActor(req).userId,'SETTLEMENT_SOURCE_VIEWED',settlement.id);
  ok(res,{booking:b,origin:settlement.origin,policy:settlement.policySnapshot,receipts,report:report?{revision:report.revision,summary:typeof payload?.summary==='string'?payload.summary:'',createdAt:report.createdAt,authorName:author?.fullName??'Agency'}:null});
});
adminWalletRouter.post('/settlements/:id/hold',limited,validate({params:z.object({id}),body:z.object({hold:z.boolean(),note:z.string().trim().min(3).max(1000)}).strict()}),async(req,res)=>ok(res,await manualHold(id.parse(req.params.id),userActor(req).userId,req.body.hold,req.body.note)));
adminWalletRouter.post('/settlements/:id/release', limited, validate({ params: z.object({ id }), body: z.object({ note: z.string().trim().min(3).max(1000) }).strict() }), async (req, res) => {
  ok(res, await settleNow(id.parse(req.params.id), userActor(req).userId, req.body.note));
});
adminWalletRouter.post('/settlements/:agencyId/release-all', limited, validate({ params: z.object({ agencyId: id }), body: z.object({ note: z.string().trim().min(3).max(1000) }).strict() }), async (req, res) => {
  ok(res, await settleAgencyNow(id.parse(req.params.agencyId), userActor(req).userId, req.body.note));
});
adminWalletRouter.get('/withdrawals',validate({query:pageQuery}),async(req,res)=>{const q=pageQuery.parse(req.query);ok(res,await withdrawalRows(q.agencyId,q.page,q.status,q.overdue==='true'));});
const receiptQuery=z.object({agencyId:id.optional(),page:z.coerce.number().int().min(1).max(100000).default(1),search:z.string().trim().max(100).default(''),status:z.enum(['MATCHED','DISCREPANCY','UNRECONCILED']).optional(),origin:z.enum(['REAL','LIVE','UNKNOWN','TEST']).default('REAL')});
adminWalletRouter.get('/receipts',validate({query:receiptQuery}),async(req,res)=>{
  const q=receiptQuery.parse(req.query),where={...(q.agencyId?{agencyId:q.agencyId}:{}),...(q.status?{reconciliationStatus:q.status}:{}),...(q.search?{booking:{bookingCode:{contains:q.search,mode:'insensitive' as const}}}:{}),payment:{...(q.origin==='REAL'?{provider:'payos'}:{financeSource:{origin:q.origin}})}};
  const [items,total]=await prisma.$transaction([prisma.agencyFinanceReceipt.findMany({where,include:{booking:{select:{bookingCode:true,tourTitle:true}},payment:{select:{provider:true,providerOrderCode:true}}},orderBy:[{paidAt:'desc'},{paymentId:'asc'}],skip:(q.page-1)*25,take:25}),prisma.agencyFinanceReceipt.count({where})]);ok(res,{items,total,page:q.page,pageSize:25});
});
adminWalletRouter.post('/reconcile/:agencyId',limited,validate({params:z.object({agencyId:id})}),async(req,res)=>{
  const agencyId=id.parse(req.params.agencyId);const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id=${agencyId}::uuid FOR UPDATE`;
    if(!await tx.agencyProfile.findUnique({where:{id:agencyId}}))throw AppError.notFound();
    const prior=await tx.agencyReconciliationRun.findFirst({where:{agencyId,status:{in:['PENDING','PROCESSING']}}});
    if(prior)return prior;const run=await tx.agencyReconciliationRun.create({data:{agencyId,actorId:userActor(req).userId}});
    await auditFinance(tx,agencyId,userActor(req).userId,'RECONCILIATION_REQUESTED',run.id);return run;
  });ok(res,result);
});
adminWalletRouter.post('/withdrawals/:id/:action',limited,validate({params:z.object({id,action:z.enum(['approve','process','complete','reject','fail'])}),body:actionBody}),async(req,res)=>{
  ok(res,await changeWithdrawal(id.parse(req.params.id),userActor(req).userId,z.enum(['approve','process','complete','reject','fail']).parse(req.params.action),actionBody.parse(req.body)));
});
adminWalletRouter.post('/jobs/retry',limited,async(req,res)=>{
  await auditFinance(prisma,null,userActor(req).userId,'SETTLEMENT_RETRY_REQUESTED','settlement');
  ok(res,{processed:await processSettlements()});
});
for(const format of ['xlsx','pdf'] as const) adminWalletRouter.get(`/reports/export.${format}`,limited,validate({query:range}),async(req,res)=>{
  const q=range.parse(req.query);
  const r=periodRange(q.period,q.from,q.to),bytes=q.agencyId?await exportFinance(q.agencyId,r.start,r.end,format,q.origin):await exportDashboardReport(await dashboard(r.start,r.end,q.origin),format);
  await auditFinance(prisma,q.agencyId??null,userActor(req).userId,'REPORT_EXPORTED',format,{from:r.start.toISOString(),to:r.end.toISOString()});
  res.set({'Content-Type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="agency-finance.${format}"`,'Cache-Control':'private, no-store'}).send(bytes);
});
