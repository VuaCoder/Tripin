import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { agencyContext, requireAgencyPermission } from '../../middlewares/agency-context';
import { requireAuth, requireSuperAdmin, userActor } from '../../middlewares/authorize';
import { validate, validated } from '../../middlewares/validate';
import { sendOk } from '../../utils/api-response';
import { AppError } from '../../utils/app-error';
import { AGENCY_PERMISSIONS as P } from '../agencies/agency.policy';
import { jsonMoney, periodRange } from './finance.rules';
import { auditFinance, lockAgency, overview, refundRows, recordRefund, reviewRefund, preparePayout, changePayout, documentHash } from './finance.service';
import { decryptBank, encryptBank } from './finance.bank';
import { exportFinance } from './finance.export';
import { createRateLimiter } from '../../middlewares/rate-limit';

const id = z.string().uuid();
const range = z.object({ period: z.enum(['week','month','quarter','custom']).default('month'), from: z.string().optional(), to: z.string().optional() });
const listQuery = range.extend({ page: z.coerce.number().int().min(1).max(100000).default(1), search: z.string().trim().max(100).default(''),
  type: z.enum(['PAYMENT','REFUND','PAYOUT']).optional(), reconciliationStatus: z.enum(['MATCHED','DISCREPANCY','UNRECONCILED']).optional() });
const manualBody = z.object({ amount: z.string().regex(/^[1-9]\d{0,15}$/), paidBy: z.enum(['AGENCY','PLATFORM']), transferredAt: z.iso.datetime({ offset: true }), bankRef: z.string().trim().min(3).max(150), proofId: id, reason: z.string().trim().min(3).max(1000), requestKey: id }).strict();
const ok = (res: Parameters<typeof sendOk>[0], data: unknown) => sendOk(res, jsonMoney(data));
const moneyMutationLimit = createRateLimiter({ windowMs: 60000, limit: 20 });
export const agencyFinanceRouter = Router();
agencyFinanceRouter.use(requireAgencyPermission(P.FINANCE_VIEW));
agencyFinanceRouter.get('/overview', validate({ query: range }), async (req,res) => {
  const q = validated<unknown,z.infer<typeof range>>(req).query, r = periodRange(q.period,q.from,q.to);
  ok(res, await overview(agencyContext(req).agencyId,r.start,r.end));
});
agencyFinanceRouter.get('/transactions', validate({ query: listQuery }), async (req,res) => {
  const q = validated<unknown,z.infer<typeof listQuery>>(req).query, r=periodRange(q.period,q.from,q.to);
  const where = { agencyId: agencyContext(req).agencyId, effectiveAt: { gte:r.start,lt:r.end }, ...(q.type ? { type:q.type } : {}), ...(q.search ? { bookingCode:{ contains:q.search,mode:'insensitive' as const } } : {}) };
  const [items,total] = await prisma.$transaction([prisma.agencyTransaction.findMany({ where, orderBy:[{effectiveAt:'desc'},{id:'desc'}], skip:(q.page-1)*25,take:25,include:{entries:true} }),prisma.agencyTransaction.count({where})]);
  ok(res,{items,total,page:q.page,pageSize:25});
});
agencyFinanceRouter.get('/receipts', validate({ query:listQuery }), async(req,res)=>{
  const q=validated<unknown,z.infer<typeof listQuery>>(req).query,r=periodRange(q.period,q.from,q.to);
  const where={agencyId:agencyContext(req).agencyId,paidAt:{gte:r.start,lt:r.end},...(q.reconciliationStatus?{reconciliationStatus:q.reconciliationStatus}:{}),...(q.search?{booking:{bookingCode:{contains:q.search,mode:'insensitive' as const}}}:{})};
  const [items,total]=await prisma.$transaction([prisma.agencyFinanceReceipt.findMany({where,include:{booking:{select:{bookingCode:true,tourTitle:true}},payment:{select:{provider:true,providerOrderCode:true,providerPaymentLinkId:true}},observations:{orderBy:{observedAt:'desc'},take:1,select:{id:true,state:true,reason:true,observedAt:true}}},orderBy:[{paidAt:'desc'},{paymentId:'desc'}],skip:(q.page-1)*25,take:25}),prisma.agencyFinanceReceipt.count({where})]);
  ok(res,{items,total,page:q.page,pageSize:25});
});
agencyFinanceRouter.post('/reconcile', requireAgencyPermission(P.FINANCE_RECONCILE), moneyMutationLimit, async(req,res)=>{
  const ctx=agencyContext(req);
  const run=await prisma.$transaction(async tx=>{
    await lockAgency(tx,ctx.agencyId);
    const running=await tx.agencyReconciliationRun.findFirst({where:{agencyId:ctx.agencyId,status:{in:['PENDING','PROCESSING']}}});
    if(running)return running;
    const result=await tx.agencyReconciliationRun.create({data:{agencyId:ctx.agencyId,actorId:ctx.actorUserId}});
    await auditFinance(tx,ctx.agencyId,ctx.actorUserId,'RECONCILIATION_REQUESTED',result.id);return result;
  });ok(res,run);
});
agencyFinanceRouter.get('/reconcile/runs', async(req,res)=>ok(res,await prisma.agencyReconciliationRun.findMany({where:{agencyId:agencyContext(req).agencyId},orderBy:{createdAt:'desc'},take:10})));
agencyFinanceRouter.get('/refunds',async(req,res)=>ok(res,await refundRows(agencyContext(req).agencyId)));
agencyFinanceRouter.post('/refunds/:bookingId/manual-payments',requireAgencyPermission(P.FINANCE_REFUND_RECORD),moneyMutationLimit,validate({params:z.object({bookingId:id}),body:manualBody}),async(req,res)=>{
  const {body,params}=validated<z.infer<typeof manualBody>,unknown,{bookingId:string}>(req),ctx=agencyContext(req);
  ok(res,await recordRefund(ctx.agencyId,ctx.actorUserId,params.bookingId,body));
});
const safePayout = (p: {bankSnapshot:unknown;[key:string]:unknown}) => {
  const bank=p.bankSnapshot as {bankName?:string;accountHolder?:string;last4?:string;version?:number};
  return {...p,bankSnapshot:{bankName:bank.bankName,accountHolder:bank.accountHolder,last4:bank.last4,version:bank.version}};
};
agencyFinanceRouter.get('/payouts',validate({query:listQuery}),async(req,res)=>{
  const q=validated<unknown,z.infer<typeof listQuery>>(req).query,r=periodRange(q.period,q.from,q.to),where={agencyId:agencyContext(req).agencyId,createdAt:{gte:r.start,lt:r.end}};
  const [items,total]=await prisma.$transaction([prisma.agencyPayout.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(q.page-1)*25,take:25,include:{items:{include:{booking:{select:{bookingCode:true}}}}}}),prisma.agencyPayout.count({where})]);
  ok(res,{items:items.map(safePayout),total,page:q.page,pageSize:25});
});
agencyFinanceRouter.get('/bank-account',async(req,res)=>{
  const b=await prisma.agencyFinanceBank.findUnique({where:{agencyId:agencyContext(req).agencyId},select:{bankName:true,accountHolder:true,last4:true,version:true,verifiedAt:true}});ok(res,b);
});
const bankBody=z.object({bankName:z.string().trim().min(2).max(100),accountHolder:z.string().trim().min(2).max(150),accountNumber:z.string().regex(/^\d{6,30}$/),expectedVersion:z.number().int().min(0)}).strict();
agencyFinanceRouter.put('/bank-account',requireAgencyPermission(P.FINANCE_BANK_MANAGE),validate({body:bankBody}),async(req,res)=>{
  const ctx=agencyContext(req),b=bankBody.parse(req.body),enc=encryptBank(ctx.agencyId,b);
  await prisma.$transaction(async tx=>{
    await lockAgency(tx,ctx.agencyId);
    const existing=await tx.agencyFinanceBank.findUnique({where:{agencyId:ctx.agencyId}});
    if((existing?.version??0)!==b.expectedVersion)throw AppError.conflict('Thông tin ngân hàng đã thay đổi. Hãy tải lại.');
    const data={bankName:b.bankName,accountHolder:b.accountHolder,...enc,updatedBy:ctx.actorUserId,verifiedAt:null,verifiedBy:null};
    await tx.agencyFinanceBank.upsert({where:{agencyId:ctx.agencyId},create:{agencyId:ctx.agencyId,...data},update:{...data,version:{increment:1}}});
    await auditFinance(tx,ctx.agencyId,ctx.actorUserId,'BANK_UPDATED',ctx.agencyId,{last4:enc.last4});
  });ok(res,{saved:true});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}}).single('file');
function detectMime(data:Buffer){
  if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(data[0]===255&&data[1]===216&&data[2]===255)return 'image/jpeg';
  if(data.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
  throw AppError.badRequest('Chỉ nhận ảnh PNG, JPG hoặc PDF, tối đa 5 MB.');
}
async function storeDocument(req:Parameters<typeof upload>[0],agencyId:string){
  const f=req.file;if(!f)throw AppError.badRequest('Chọn chứng từ cần tải lên.');
  const mimeType=detectMime(f.buffer),actorId=userActor(req).userId;
  return prisma.$transaction(async tx=>{
    const doc=await tx.agencyFinanceDocument.create({data:{agencyId,actorId,name:f.originalname.replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(0,150),mimeType,data:new Uint8Array(f.buffer),sha256:documentHash(f.buffer)},select:{id:true,name:true,mimeType:true}});
    await auditFinance(tx,agencyId,actorId,'DOCUMENT_UPLOADED',doc.id);return doc;
  });
}
agencyFinanceRouter.post('/documents',requireAgencyPermission(P.FINANCE_REFUND_RECORD),moneyMutationLimit,upload,async(req,res)=>ok(res,await storeDocument(req,agencyContext(req).agencyId)));
agencyFinanceRouter.get('/documents/:id',validate({params:z.object({id})}),async(req,res)=>{
  const doc=await prisma.agencyFinanceDocument.findFirst({where:{id:id.parse(req.params.id),agencyId:agencyContext(req).agencyId}});
  if(!doc)throw AppError.notFound();await auditFinance(prisma,doc.agencyId,userActor(req).userId,'DOCUMENT_DOWNLOADED',doc.id);
  res.set({'Content-Type':doc.mimeType,'Content-Disposition':`attachment; filename="document${doc.mimeType==='application/pdf'?'.pdf':doc.mimeType==='image/png'?'.png':'.jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(Buffer.from(doc.data));
});
for(const format of ['xlsx','pdf'] as const)agencyFinanceRouter.get(`/reports/export.${format}`,requireAgencyPermission(P.FINANCE_EXPORT),moneyMutationLimit,validate({query:range}),async(req,res)=>{
  const q=validated<unknown,z.infer<typeof range>>(req).query,r=periodRange(q.period,q.from,q.to),ctx=agencyContext(req);
  const result=await exportFinance(ctx.agencyId,r.start,r.end,format);await auditFinance(prisma,ctx.agencyId,ctx.actorUserId,'REPORT_EXPORTED',format,{from:r.start.toISOString(),to:r.end.toISOString()});
  res.set({'Content-Type':format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf','Content-Disposition':`attachment; filename="agency-finance.${format}"`,'Cache-Control':'private, no-store'}).send(result);
});

export const adminFinanceRouter=Router();
adminFinanceRouter.use(requireAuth,requireSuperAdmin);
adminFinanceRouter.get('/agencies',async(_req,res)=>ok(res,await prisma.agencyProfile.findMany({select:{id:true,companyName:true,verificationStatus:true},orderBy:{companyName:'asc'},take:1000})));
adminFinanceRouter.get('/policy',async(_req,res)=>ok(res,await prisma.agencyFinancePolicy.findUnique({where:{id:'default'}})));
adminFinanceRouter.put('/policy',validate({body:z.object({holdDays:z.number().int().min(0).max(90),refundCommissionPolicy:z.literal('PROPORTIONAL')}).strict()}),async(req,res)=>{
  const body=z.object({holdDays:z.number().int().min(0).max(90),refundCommissionPolicy:z.literal('PROPORTIONAL')}).parse(req.body);
  ok(res,await prisma.agencyFinancePolicy.upsert({where:{id:'default'},create:{...body,updatedBy:userActor(req).userId},update:{...body,updatedBy:userActor(req).userId}}));
});
adminFinanceRouter.get('/agencies/:agencyId',validate({params:z.object({agencyId:id}),query:range}),async(req,res)=>{
  const agencyId=id.parse(req.params.agencyId),q=range.parse(req.query),r=periodRange(q.period,q.from,q.to);
  const [summary,refunds,payouts,bank,audit]=await Promise.all([overview(agencyId,r.start,r.end),prisma.agencyManualRefund.findMany({where:{agencyId},include:{booking:{select:{bookingCode:true}}},orderBy:{createdAt:'desc'},take:200}),prisma.agencyPayout.findMany({where:{agencyId},orderBy:{createdAt:'desc'},take:100,include:{items:{include:{booking:{select:{bookingCode:true}}}}}}),prisma.agencyFinanceBank.findUnique({where:{agencyId},select:{bankName:true,accountHolder:true,last4:true,version:true,verifiedAt:true}}),prisma.agencyFinanceAudit.findMany({where:{agencyId},orderBy:{createdAt:'desc'},take:50})]);
  ok(res,{summary,refunds,payouts:payouts.map(safePayout),bank,audit});
});
adminFinanceRouter.post('/refunds/:id/review',moneyMutationLimit,validate({params:z.object({id}),body:z.object({confirm:z.boolean(),note:z.string().trim().min(3).max(1000)}).strict()}),async(req,res)=>ok(res,await reviewRefund(id.parse(req.params.id),userActor(req).userId,req.body.confirm,req.body.note)));
adminFinanceRouter.get('/agencies/:agencyId/bank-details',validate({params:z.object({agencyId:id})}),async(req,res)=>{
  const agencyId=id.parse(req.params.agencyId),bank=await prisma.agencyFinanceBank.findUnique({where:{agencyId}});
  if(!bank)throw AppError.notFound();await auditFinance(prisma,agencyId,userActor(req).userId,'BANK_DETAILS_VIEWED',agencyId);
  res.set('Cache-Control','no-store');ok(res,{...decryptBank(agencyId,bank),version:bank.version});
});
adminFinanceRouter.post('/agencies/:agencyId/bank-verify',validate({params:z.object({agencyId:id}),body:z.object({expectedVersion:z.number().int().min(1)}).strict()}),async(req,res)=>{
  const agencyId=id.parse(req.params.agencyId),actorId=userActor(req).userId;
  await prisma.$transaction(async tx=>{await lockAgency(tx,agencyId);const b=await tx.agencyFinanceBank.findUniqueOrThrow({where:{agencyId}});
    if(b.version!==req.body.expectedVersion)throw AppError.conflict('Thông tin ngân hàng đã thay đổi.');if(b.updatedBy===actorId)throw AppError.forbidden('Người sửa không được tự xác minh.');
    await tx.agencyFinanceBank.update({where:{agencyId},data:{verifiedAt:new Date(),verifiedBy:actorId}});await auditFinance(tx,agencyId,actorId,'BANK_VERIFIED',agencyId,{version:b.version});});ok(res,{verified:true});
});
adminFinanceRouter.post('/agencies/:agencyId/payouts',moneyMutationLimit,validate({params:z.object({agencyId:id}),body:range}),async(req,res)=>{
  const q=range.parse(req.body),r=periodRange(q.period,q.from,q.to);ok(res,safePayout(await preparePayout(id.parse(req.params.agencyId),userActor(req).userId,r.start,r.end)));
});
adminFinanceRouter.post('/payouts/:id/:action',moneyMutationLimit,validate({params:z.object({id,action:z.enum(['approve','cancel','complete'])}),body:z.object({bankRef:z.string().trim().min(3).max(150).optional(),proofId:id.optional()}).strict()}),async(req,res)=>ok(res,safePayout(await changePayout(id.parse(req.params.id),userActor(req).userId,z.enum(['approve','cancel','complete']).parse(req.params.action),req.body))));
adminFinanceRouter.post('/agencies/:agencyId/documents',moneyMutationLimit,validate({params:z.object({agencyId:id})}),upload,async(req,res)=>ok(res,await storeDocument(req,id.parse(req.params.agencyId))));
adminFinanceRouter.get('/documents/:id',validate({params:z.object({id})}),async(req,res)=>{
  const doc=await prisma.agencyFinanceDocument.findUnique({where:{id:id.parse(req.params.id)}});if(!doc)throw AppError.notFound();
  await auditFinance(prisma,doc.agencyId,userActor(req).userId,'DOCUMENT_DOWNLOADED',doc.id);
  res.set({'Content-Type':doc.mimeType,'Content-Disposition':'attachment; filename="finance-document"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(Buffer.from(doc.data));
});
