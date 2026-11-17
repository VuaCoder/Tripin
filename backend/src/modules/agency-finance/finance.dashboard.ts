import { prisma, type DbExecutor } from '../../config/database';
import { activePolicy } from './finance.wallet';
export type Origin = 'LIVE' | 'TEST' | 'UNKNOWN';
const sum = (rows: bigint[]) => rows.reduce((a,b) => a+b,0n);
/** Every counter shares the same snapshot, origin and ledger; balances and period movements remain separate. */
export async function dashboard(start: Date, end: Date, origin: Origin = 'LIVE', agencyId?: string) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ account: string; type: string; net: bigint; debit: bigint; credit: bigint }[]>`
      SELECT e.account,t.type,SUM(e.credit-e.debit)::bigint AS net,
        COALESCE(SUM(e.debit) FILTER(WHERE t."effectiveAt">=${start}),0)::bigint AS debit,
        COALESCE(SUM(e.credit) FILTER(WHERE t."effectiveAt">=${start}),0)::bigint AS credit
      FROM "AgencyTransaction" t JOIN "AgencyLedgerEntry" e ON e."transactionId"=t.id
      WHERE t."effectiveAt"<${end} AND (${agencyId ?? null}::uuid IS NULL OR t."agencyId"=${agencyId ?? null}::uuid)
        AND EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" s ON s."paymentId"=p.id WHERE p.purpose='BOOKING' AND p."referenceId"=t."bookingId" AND s.origin=${origin})
      GROUP BY e.account,t.type`;
    const balance = (account: string) => sum(rows.filter(r=>r.account===account).map(r=>r.net));
    const gmv = sum(rows.filter(r=>r.account==='PLATFORM_CASH'&&r.type==='PAYMENT').map(r=>r.debit));
    const paid = sum(rows.filter(r=>r.account==='PLATFORM_CASH'&&r.type==='PAYOUT').map(r=>r.credit));
    const commission = sum(rows.filter(r=>r.account==='PLATFORM_COMMISSION'&&['PAYMENT','REFUND'].includes(r.type)).map(r=>r.credit-r.debit));
    const earnedCommission = sum(rows.filter(r=>r.account==='PLATFORM_COMMISSION_EARNED').map(r=>r.credit-r.debit));
    const cashflow = await tx.$queryRaw<{ date:string; receipts:bigint; paid:bigint; commission:bigint }[]>`
      SELECT to_char(t."effectiveAt"+interval '7 hours','YYYY-MM-DD') AS date,
        SUM(CASE WHEN e.account='PLATFORM_CASH' AND t.type='PAYMENT' THEN e.debit ELSE 0 END)::bigint AS receipts,
        SUM(CASE WHEN e.account='PLATFORM_CASH' AND t.type='PAYOUT' THEN e.credit ELSE 0 END)::bigint AS paid,
        SUM(CASE WHEN e.account='PLATFORM_COMMISSION' THEN e.credit-e.debit ELSE 0 END)::bigint AS commission
      FROM "AgencyTransaction" t JOIN "AgencyLedgerEntry" e ON e."transactionId"=t.id
      WHERE t."effectiveAt">=${start} AND t."effectiveAt"<${end}
        AND (${agencyId ?? null}::uuid IS NULL OR t."agencyId"=${agencyId ?? null}::uuid)
        AND t.type IN ('PAYMENT','PAYOUT','REFUND')
        AND EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" s ON s."paymentId"=p.id WHERE p.purpose='BOOKING' AND p."referenceId"=t."bookingId" AND s.origin=${origin})
      GROUP BY date ORDER BY date`;
    const released = await tx.$queryRaw<{ amount:bigint }[]>`
      SELECT COALESCE(SUM(t.amount),0)::bigint AS amount FROM "AgencyTransaction" t
      WHERE t."eventKey" LIKE 'settlement:%' AND t."effectiveAt">=${start} AND t."effectiveAt"<${end}
        AND (${agencyId ?? null}::uuid IS NULL OR t."agencyId"=${agencyId ?? null}::uuid)
        AND EXISTS(SELECT 1 FROM "AgencySettlement" s WHERE s."bookingId"=t."bookingId" AND s.origin=${origin})`;
    const counts = await tx.agencyWithdrawal.groupBy({ by:['status'], where: { ...(agencyId?{agencyId}: {}) }, _count:true });
    const worker = await tx.agencyFinanceWorker.findUnique({where:{id:'settlement'}});
    const policy=await activePolicy(tx);
    const overdue=await tx.agencyWithdrawal.count({where:{...(agencyId?{agencyId}:{}),status:{in:['PENDING','APPROVED','PROCESSING']},createdAt:{lt:new Date(Date.now()-(policy?.processingHours??48)*3600000)}}});
    const unverifiedBanks=await tx.agencyProfile.count({where:{...(agencyId?{id:agencyId}:{}),OR:[{financeBank:null},{financeBank:{verifiedAt:null}}]}});
    const unreconciled=await tx.agencyFinanceReceipt.count({where:{...(agencyId?{agencyId}:{}),reconciliationStatus:{not:'MATCHED'},payment:{provider:'payos'}}});
    const aging = await tx.$queryRaw<{ age:string; amount:bigint }[]>`
      SELECT CASE WHEN s."createdAt">CURRENT_TIMESTAMP-interval '7 days' THEN 'Dưới 7 ngày'
        WHEN s."createdAt">CURRENT_TIMESTAMP-interval '14 days' THEN '7–14 ngày'
        WHEN s."createdAt">CURRENT_TIMESTAMP-interval '30 days' THEN '15–30 ngày' ELSE 'Trên 30 ngày' END AS age,
        SUM(b."agencyAmount")::bigint AS amount FROM "AgencySettlement" s JOIN "Booking" b ON b.id=s."bookingId"
      WHERE s."releasedAt" IS NULL AND s.origin=${origin} AND (${agencyId??null}::uuid IS NULL OR s."agencyId"=${agencyId??null}::uuid)
      GROUP BY age`;
    return { origin,start,end,asOf:new Date(), gmv,paid,commission,earnedCommission,released:released[0]?.amount??0n,
      balances:{pending:balance('AGENCY_PAYABLE'),available:balance('AGENCY_AVAILABLE'),reserved:balance('AGENCY_RESERVED'),frozen:balance('AGENCY_FROZEN')},cashflow,aging,
      tasks:{pending:counts.find(c=>c.status==='PENDING')?._count??0,processing:counts.find(c=>c.status==='PROCESSING')?._count??0,overdue,unverifiedBanks,unreconciled},worker };
  },{isolationLevel:'RepeatableRead'});
}
export async function agencyDirectory(q: string, page: number, filter = 'ALL', origin: Origin = 'LIVE') {
  return prisma.$transaction(async tx => {
    const rows = await directoryRows(tx,q,filter,origin,page);
    return { items: rows, total:Number(rows[0]?.totalCount??0),page,pageSize:12 };
  },{isolationLevel:'RepeatableRead'});
}
async function directoryRows(tx:DbExecutor,q:string,filter:string,origin:Origin,page:number) {
  return tx.$queryRaw<{ id:string; name:string; avatarUrl:string|null; address:string|null; verified:boolean; available:bigint; pending:bigint; frozen:bigint; requests:bigint; totalCount:bigint }[]>`
    SELECT a.id,COALESCE(a."companyName",'Agency') AS name,u."avatarUrl",a.address,
      (a."verificationStatus"='VERIFIED') AS verified,COALESCE(v.available,0)::bigint AS available,
      COALESCE(v.pending,0)::bigint AS pending,COALESCE(v.frozen,0)::bigint AS frozen,COALESCE(w.requests,0)::bigint AS requests,
      count(*) OVER() AS "totalCount"
    FROM "AgencyProfile" a LEFT JOIN "User" u ON u.id=a."userId"
    LEFT JOIN "AgencyFinanceBank" bank ON bank."agencyId"=a.id
    LEFT JOIN LATERAL (
      SELECT SUM(CASE WHEN e.account='AGENCY_AVAILABLE' THEN e.credit-e.debit ELSE 0 END) AS available,
        SUM(CASE WHEN e.account='AGENCY_PAYABLE' THEN e.credit-e.debit ELSE 0 END) AS pending,
        SUM(CASE WHEN e.account='AGENCY_FROZEN' THEN e.credit-e.debit ELSE 0 END) AS frozen
      FROM "AgencyTransaction" t JOIN "AgencyLedgerEntry" e ON e."transactionId"=t.id WHERE t."agencyId"=a.id
        AND EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" s ON s."paymentId"=p.id WHERE p.purpose='BOOKING' AND p."referenceId"=t."bookingId" AND s.origin=${origin})
    ) v ON true
    LEFT JOIN LATERAL (SELECT count(*) AS requests FROM "AgencyWithdrawal" w WHERE w."agencyId"=a.id AND w.status IN ('PENDING','APPROVED','PROCESSING')) w ON true
    WHERE COALESCE(a."companyName",'Agency') ILIKE ${'%'+q+'%'}
      AND (${filter}='ALL' OR ${filter}='BALANCE' AND COALESCE(v.available,0)>0
        OR ${filter}='WITHDRAWALS' AND COALESCE(w.requests,0)>0
        OR ${filter}='FROZEN' AND COALESCE(v.frozen,0)>0
        OR ${filter}='UNVERIFIED_BANK' AND bank."verifiedAt" IS NULL)
    ORDER BY COALESCE(w.requests,0) DESC,COALESCE(a."companyName",'Agency'),a.id LIMIT 12 OFFSET ${(page-1)*12}`;
}
