import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { FIXED_POLICY_ID } from './finance.policy';
import { prisma, type DbExecutor } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../utils/app-error';
import { auditFinance, lockAgency, post } from './finance.service';
import { positiveMoney } from './finance.rules';
import { writeAgencyNotification, writeNotification } from '../notifications/notifications.writer';
import { AGENCY_PERMISSIONS as P, type AgencyContext } from '../agencies/agency.policy';
import { lockAgencyAccess } from '../agencies/agency-access.service';
import { logger } from '../../utils/logger';

export type WalletPolicy = {
  holdDays: number; autoSettlement: boolean; minWithdrawal: string; maxWithdrawal: string;
  dailyWithdrawalLimit: string; processingHours: number; includeExistingReports?: boolean;
};
export const reasonLabels: Record<string, string> = {
  NO_POLICY: 'Chưa có chính sách', AUTOMATION_PAUSED: 'Tự động quyết toán đang tạm dừng',
  UNVERIFIED_SOURCE: 'Khoản thu chưa được xác minh', TEST_SOURCE: 'Dữ liệu mô phỏng',
  NOT_PAID: 'Chưa xác nhận thu tiền', PAYMENT_MISMATCH: 'Khoản thu chưa khớp',
  NO_REPORT: 'Chưa có báo cáo hoàn tất', NOT_COMPLETED: 'Booking chưa hoàn tất', HOLD_PERIOD: 'Chưa hết thời gian giữ tiền',
  AGENCY_UNVERIFIED: 'Agency chưa xác minh', DISPUTE: 'Có khiếu nại chưa giải quyết',
  MANUAL_HOLD: 'Admin đang tạm giữ khoản tiền này',
  WORKER_ERROR: 'Chưa kiểm tra được hồ sơ; hệ thống sẽ thử lại',
  FINANCIAL_OBLIGATION: 'Còn nghĩa vụ tài chính chưa xử lý', LEGACY_RESERVATION: 'Đã thuộc kỳ quyết toán cũ',
};
const total = (rows: bigint[]) => rows.reduce((a, b) => a + b, 0n);
const asJson = (data: unknown) => JSON.parse(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? String(v) : v)) as Prisma.InputJsonValue;
const walletAccounts = ['AGENCY_PAYABLE', 'AGENCY_AVAILABLE', 'AGENCY_RESERVED', 'AGENCY_FROZEN'];
export function walletOrigin(agencyId: string): 'TEST' | 'LIVE' {
  return env.NODE_ENV !== 'production' && env.FINANCE_SANDBOX_AGENCY_IDS.split(',').map(id => id.trim()).includes(agencyId) ? 'TEST' : 'LIVE';
}
export async function activePolicy(tx: DbExecutor, now = new Date()) {
  const version = await tx.agencySettlementPolicyVersion.findFirst({ where: { id: FIXED_POLICY_ID, effectiveAt: { lte: now } }, orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] });
  return version ? { id: version.id, actorId: version.actorId, ...(version.snapshot as WalletPolicy) } : null;
}
async function source(tx: DbExecutor, paymentId: string, provider: string) {
  return tx.agencyFinanceSource.upsert({ where: { paymentId }, update: {}, create: { paymentId, origin: provider === 'TEST-FINANCE' ? 'TEST' : 'UNKNOWN' } });
}
async function bookingBalances(tx: DbExecutor, agencyId: string, bookingId?: string, origin?: string) {
  return tx.$queryRaw<{ bookingId: string; account: string; balance: bigint }[]>`
    SELECT t."bookingId",e.account,SUM(e.credit-e.debit)::bigint AS balance
    FROM "AgencyTransaction" t JOIN "AgencyLedgerEntry" e ON e."transactionId"=t.id
    WHERE t."agencyId"=${agencyId}::uuid AND t."bookingId" IS NOT NULL
      AND (${bookingId ?? null}::uuid IS NULL OR t."bookingId"=${bookingId ?? null}::uuid)
      AND (${origin ?? null}::text IS NULL OR EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" s ON s."paymentId"=p.id WHERE p.purpose='BOOKING' AND p."referenceId"=t."bookingId" AND s.origin=${origin ?? null}))
      AND e.account IN ('AGENCY_PAYABLE','AGENCY_AVAILABLE','AGENCY_RESERVED','AGENCY_FROZEN')
    GROUP BY t."bookingId",e.account`;
}
export async function walletBalances(tx: DbExecutor, agencyId: string) {
  const rows = await bookingBalances(tx, agencyId, undefined, walletOrigin(agencyId));
  const sum = (account: string) => total(rows.filter(r => r.account === account).map(r => r.balance));
  const bank = await tx.agencyFinanceBank.findUnique({ where: { agencyId }, select: { verifiedAt: true } });
  const policy = await activePolicy(tx);
  return { pending: sum('AGENCY_PAYABLE'), available: sum('AGENCY_AVAILABLE'), reserved: sum('AGENCY_RESERVED'), frozen: sum('AGENCY_FROZEN'),
    total: total(rows.map(r => r.balance)), bankVerified: !!bank?.verifiedAt, policy };
}

/** All callers hold the agency lock; source triggers serialize old application writers too. */
async function conditions(tx: DbExecutor, bookingId: string, now = new Date()) {
  const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const payments = await tx.payment.findMany({ where: { purpose: 'BOOKING', referenceId: b.id, status: 'PAID' } });
  const reasons: string[] = [];
  let origin = 'UNKNOWN';
  if (!b.isPaid || payments.length !== 1) reasons.push('NOT_PAID');
  if (payments.length === 1) {
    const p = payments[0]!; origin = (await source(tx, p.id, p.provider)).origin;
    const sandboxReceipt = walletOrigin(b.agencyId) === 'TEST' && origin === 'TEST' && p.provider === 'TEST-FINANCE';
    if (origin !== 'LIVE' && !sandboxReceipt) reasons.push(origin === 'TEST' ? 'TEST_SOURCE' : 'UNVERIFIED_SOURCE');
    const receipt = await tx.agencyFinanceReceipt.findUnique({ where: { paymentId: p.id } });
    if (p.amount !== b.totalAmount || p.currency !== 'VND' || receipt?.reconciliationStatus !== 'MATCHED' || receipt.actualAmount !== p.amount) reasons.push('PAYMENT_MISMATCH');
  }
  const agency = await tx.agencyProfile.findUniqueOrThrow({ where: { id: b.agencyId } });
  if (agency.verificationStatus !== 'VERIFIED') reasons.push('AGENCY_UNVERIFIED');
  const hold = await tx.agencyFinanceAudit.findFirst({ where: { agencyId:b.agencyId,entityId:b.id,action:{in:['MANUAL_FINANCE_HOLD','MANUAL_FINANCE_RELEASE']} },orderBy:[{createdAt:'desc'},{id:'desc'}] });
  if(hold?.action==='MANUAL_FINANCE_HOLD')reasons.push('MANUAL_HOLD');
  if (b.status !== 'COMPLETED' || b.endDate > now) reasons.push('NOT_COMPLETED');
  const completion = await tx.tourCompletion.findUnique({ where: { departureId: b.departureId } });
  if (!completion?.completedAt || completion.agencyId !== b.agencyId || completion.tourId !== b.tourId || !await tx.tourCompletionReport.findFirst({ where: { completionId: completion.id, submitted: true } })) reasons.push('NO_REPORT');
  if (await tx.complaintTicket.findFirst({ where: { bookingId: b.id, status: { notIn: ['RESOLVED', 'CLOSED'] } }, select: { id: true } })) reasons.push('DISPUTE');
  if (b.refundRequired || await tx.agencyManualRefund.findFirst({ where: { bookingId: b.id, status: 'PENDING' }, select: { id: true } })) reasons.push('FINANCIAL_OBLIGATION');
  if (await tx.agencyPayoutItem.findFirst({ where: { bookingId: b.id, payout: { status: { notIn: ['CANCELLED', 'FAILED'] } } }, select: { id: true } })) reasons.push('LEGACY_RESERVATION');
  return { b, completion, reasons, origin };
}
async function move(tx: DbExecutor, agencyId: string, bookingId: string, amount: bigint, from: string, to: string, key: string, description: string, actorId?: string) {
  if (amount <= 0n) return;
  const booking=await tx.booking.findUniqueOrThrow({where:{id:bookingId},select:{bookingCode:true}});
  await post(tx, { agencyId, bookingId, bookingCode:booking.bookingCode, type: 'ADJUSTMENT', amount, eventKey: key, description, effectiveAt: new Date(), actorId }, [
    { account: from, debit: amount, credit: 0n }, { account: to, debit: 0n, credit: amount },
  ]);
}

export async function evaluateSettlement(bookingId: string, now = new Date(), earlyRelease?: { actorId: string; note: string }) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('agency-finance-policy'))`;
    const initial = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { agencyId: true } });
    await lockAgency(tx, initial.agencyId);
    if (earlyRelease) {
      const actor = await tx.user.findFirst({ where: { id: earlyRelease.actorId, role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' }, select: { id: true } });
      if (!actor) throw AppError.forbidden();
      if (earlyRelease.note.trim().length < 3) throw AppError.badRequest('Cần ghi lý do quyết toán sớm.');
    }
    const check = await conditions(tx, bookingId, now);
    const active = await activePolicy(tx, now);
    let s = await tx.agencySettlement.findUnique({ where: { bookingId } });
    // Capture timing only after the first submitted completion report; future policy edits cannot reset it.
    if (!s || !s.policyVersionId && active && check.completion?.completedAt) {
      const historical = check.completion?.completedAt ? await activePolicy(tx,check.completion.completedAt) : null;
      const captured = historical ?? (active?.includeExistingReports ? active : null);
      const capture = !!captured && !!check.completion?.completedAt;
      const eligibleAt = capture ? new Date(Math.max(check.b.endDate.getTime(), check.completion!.completedAt!.getTime()) + captured!.holdDays * 86400000) : null;
      const data = { agencyId: check.b.agencyId, origin: check.origin, policyVersionId: capture ? captured!.id : null,
        policySnapshot: capture ? asJson(captured) : {}, eligibleAt };
      s = await tx.agencySettlement.upsert({ where: { bookingId }, create: { bookingId, ...data }, update: data });
    }
    const reasons = [...check.reasons];
    if (!active || !s.policyVersionId) reasons.push('NO_POLICY');
    if (!active?.autoSettlement) reasons.push('AUTOMATION_PAUSED');
    if (s.eligibleAt && s.eligibleAt > now && !earlyRelease) reasons.push('HOLD_PERIOD');
    if (earlyRelease && s.releasedAt) return { ...s, releasedNow: false };
    if (earlyRelease && reasons.length) throw AppError.conflict(`Chưa thể quyết toán: ${reasons.map(r => r === 'TEST_SOURCE' ? 'Khoản thu chưa được xác minh' : reasonLabels[r] ?? r).join('; ')}.`);
    const balances = await bookingBalances(tx, check.b.agencyId, bookingId);
    const balance = (a: string) => balances.find(r => r.account === a)?.balance ?? 0n;
    let releasedNow = false;
    if (!s.releasedAt && reasons.length === 0) {
      const pending = balance('AGENCY_PAYABLE');
      // A historical negative balance is never ignored to make the wallet look spendable.
      const agencyBalances = await bookingBalances(tx, check.b.agencyId);
      if (pending > 0n && !agencyBalances.some(row => row.balance < 0n)) {
        await move(tx, s.agencyId, bookingId, pending, 'AGENCY_PAYABLE', 'AGENCY_AVAILABLE', `settlement:${s.id}`, earlyRelease ? 'Admin quyết toán sớm vào số dư có thể rút' : 'Tự động quyết toán vào số dư có thể rút', earlyRelease?.actorId);
        if (check.b.commissionAmount > 0n) await post(tx, { agencyId:s.agencyId,bookingId,bookingCode:check.b.bookingCode,type:'ADJUSTMENT',amount:check.b.commissionAmount,eventKey:`commission-earned:${s.id}`,effectiveAt:now,description:'Ghi nhận hoa hồng sau quyết toán' },[
          {account:'PLATFORM_COMMISSION',debit:check.b.commissionAmount,credit:0n},{account:'PLATFORM_COMMISSION_EARNED',debit:0n,credit:check.b.commissionAmount},
        ]);
        await tx.agencySettlement.update({ where: { id: s.id }, data: { releasedAt: now, amount: pending } });
        releasedNow = true;
        await auditFinance(tx, s.agencyId, earlyRelease?.actorId ?? active!.actorId, 'SETTLEMENT_RELEASED', s.id, { automatic: !earlyRelease, amount: String(pending), policyVersionId: s.policyVersionId, ...(earlyRelease ? { bypassedHold: true, note: earlyRelease.note.trim(), originalEligibleAt: s.eligibleAt?.toISOString() ?? null } : {}) });
        await writeAgencyNotification(tx, s.agencyId, { type: 'FINANCE_SETTLED', title: 'Chuyến đi đã được quyết toán', body: `${check.b.bookingCode}: ${pending.toLocaleString('vi-VN')} đ đã chuyển sang số dư có thể rút.`, data: { href: '/agency/finance?tab=settlements', settlementId: s.id } }, false);
      } else if (earlyRelease) throw AppError.conflict('Không có số dư đủ điều kiện hoặc Agency còn số dư âm cần xử lý.');
    } else if (s.releasedAt) {
      const blockers = reasons.filter(r => !['HOLD_PERIOD', 'AUTOMATION_PAUSED', 'NO_POLICY'].includes(r));
      if (blockers.length && balance('AGENCY_AVAILABLE') > 0n) {
        await move(tx, s.agencyId, bookingId, balance('AGENCY_AVAILABLE'), 'AGENCY_AVAILABLE', 'AGENCY_FROZEN', `freeze:${s.id}:${randomUUID()}`, 'Tạm giữ số dư do điều kiện nguồn thay đổi');
      } else if (!blockers.length && balance('AGENCY_FROZEN') > 0n) {
        await move(tx, s.agencyId, bookingId, balance('AGENCY_FROZEN'), 'AGENCY_FROZEN', 'AGENCY_AVAILABLE', `unfreeze:${s.id}:${randomUUID()}`, 'Giải phóng khoản tạm giữ sau kiểm tra lại');
      }
    }
    return { ...await tx.agencySettlement.update({ where: { id: s.id }, data: { reasons, checkedAt: now, origin: check.origin } }), releasedNow };
  }, { timeout: 20000 });
}

export async function settleNow(settlementId: string, actorId: string, note: string) {
  const row = await prisma.agencySettlement.findUnique({ where: { id: settlementId }, select: { bookingId: true } });
  if (!row) throw AppError.notFound();
  return evaluateSettlement(row.bookingId, new Date(), { actorId, note });
}

/** One Agency-wide operation, including bookings not yet discovered by the scheduled worker. */
export async function settleAgencyNow(agencyId: string, actorId: string, note: string) {
  if (note.trim().length < 3 || note.trim().length > 1000) throw AppError.badRequest('Cần ghi lý do quyết toán sớm.');
  if (!await prisma.user.findFirst({ where: { id: actorId, role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' }, select: { id: true } })) throw AppError.forbidden();
  if (!await prisma.agencyProfile.findUnique({ where: { id: agencyId }, select: { id: true } })) throw AppError.notFound();
  const cutoff = new Date();
  let cursor: string | null = null;
  let settled = 0, skipped = 0, failed = 0, alreadySettled = 0, totalAmount = 0n;
  while (true) {
    const rows: { id: string; canAttempt: boolean }[] = await prisma.$queryRaw`
      SELECT b.id, (b."isPaid" AND b.status='COMPLETED' AND b."endDate"<=${cutoff}
        AND EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" src ON src."paymentId"=p.id
          JOIN "AgencyFinanceReceipt" receipt ON receipt."paymentId"=p.id
          WHERE p."referenceId"=b.id AND p.purpose='BOOKING' AND p.status='PAID'
            AND (src.origin='LIVE' OR (${walletOrigin(agencyId) === 'TEST'} AND src.origin='TEST' AND p.provider='TEST-FINANCE'))
            AND receipt."reconciliationStatus"='MATCHED' AND receipt."actualAmount"=p.amount
            AND p.amount=b."totalAmount" AND p.currency='VND')
        AND EXISTS(SELECT 1 FROM "TourCompletion" c JOIN "TourCompletionReport" report ON report."completionId"=c.id
          WHERE c."departureId"=b."departureId" AND c."agencyId"=b."agencyId" AND c."tourId"=b."tourId"
            AND c."completedAt" IS NOT NULL AND report.submitted=true)) AS "canAttempt"
      FROM "Booking" b LEFT JOIN "AgencySettlement" s ON s."bookingId"=b.id
      WHERE b."agencyId"=${agencyId}::uuid AND s."releasedAt" IS NULL
        AND (${cursor}::uuid IS NULL OR b.id>${cursor}::uuid)
        AND EXISTS(SELECT 1 FROM "AgencyTransaction" t WHERE t."bookingId"=b.id AND t.type='PAYMENT' AND t."createdAt"<=${cutoff})
      ORDER BY b.id LIMIT 100`;
    if (!rows.length) break;
    for (const row of rows) {
      // Reject obvious blockers in one query; genuine candidates still get every transactional check.
      if (!row.canAttempt) { skipped++; continue; }
      try {
        const result = await evaluateSettlement(row.id, new Date(), { actorId, note });
        if (result.releasedNow) { settled++; totalAmount += result.amount; } else alreadySettled++;
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 403) throw error;
        if (error instanceof AppError && error.statusCode === 409) skipped++;
        else { failed++; logger.error('Agency settlement record failed', { agencyId, bookingId: row.id, message: (error as Error).message }); }
      }
    }
    cursor = rows[rows.length-1]!.id;
  }
  return { settled, skipped, failed, alreadySettled, totalAmount: String(totalAmount) };
}

export async function processSettlements(now = new Date()) {
  await prisma.agencyFinanceWorker.upsert({ where: { id: 'settlement' }, create: { lastStartedAt: now }, update: { lastStartedAt: now } });
  try {
    const rows = await prisma.$queryRaw<{ id: string; agencyId:string }[]>`
      SELECT b.id,b."agencyId" FROM "Booking" b JOIN "AgencyTransaction" t ON t."bookingId"=b.id AND t.type='PAYMENT'
      LEFT JOIN "AgencySettlement" s ON s."bookingId"=b.id
      ORDER BY s."checkedAt" ASC NULLS FIRST,b.id LIMIT 100`;
    let failures=0;
    for (const row of rows) {
      try{await evaluateSettlement(row.id,now);}catch(error){
        failures++;logger.error('Settlement record failed',{bookingId:row.id,message:(error as Error).message});
        try{await prisma.agencySettlement.upsert({where:{bookingId:row.id},create:{bookingId:row.id,agencyId:row.agencyId,policySnapshot:{},checkedAt:now,reasons:['WORKER_ERROR']},update:{checkedAt:now,reasons:['WORKER_ERROR']}});}catch{/* Database outage remains visible through worker heartbeat. */}
      }
    }
    await prisma.agencyFinanceWorker.update({ where: { id: 'settlement' }, data: { ...(failures?{}:{lastSucceededAt: new Date()}), lastError:failures?`${failures} hồ sơ cần kiểm tra; hệ thống sẽ thử lại.`:null,processed:rows.length-failures } });
    return rows.length-failures;
  } catch (error) {
    await prisma.agencyFinanceWorker.update({ where: { id: 'settlement' }, data: { lastError: 'Không thể xử lý quyết toán. Kiểm tra nhật ký máy chủ.' } });
    throw error;
  }
}

export async function requestWithdrawal(agencyId: string, actorId: string, amountText: string, requestKey: string, ctx?: AgencyContext) {
  const amount = positiveMoney(amountText);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('agency-finance-policy'))`;
    if (ctx) await lockAgencyAccess(tx, ctx, P.FINANCE_WITHDRAW); else await lockAgency(tx, agencyId);
    const prior = await tx.agencyWithdrawal.findUnique({ where: { agencyId_requestKey: { agencyId, requestKey } } });
    if (prior) { if (prior.requestedBy !== actorId || prior.amount !== amount) throw AppError.conflict('Mã yêu cầu đã dùng cho nội dung khác.'); return safeWithdrawal(prior); }
    const policy = await activePolicy(tx);
    if (!policy) throw AppError.conflict('Sàn chưa cấu hình quyết toán.');
    if (amount < BigInt(policy.minWithdrawal) || amount > BigInt(policy.maxWithdrawal)) throw AppError.badRequest(`Số tiền rút phải từ ${BigInt(policy.minWithdrawal).toLocaleString('vi-VN')} đến ${BigInt(policy.maxWithdrawal).toLocaleString('vi-VN')} đ.`);
    const bank = await tx.agencyFinanceBank.findUnique({ where: { agencyId } });
    if (!bank?.verifiedAt) throw AppError.conflict('Tài khoản ngân hàng chưa xác minh.');
    const start = new Date(new Date(Date.now() + 25200000).toISOString().slice(0, 10) + 'T00:00:00+07:00');
    const day = await tx.agencyWithdrawal.aggregate({ where: { agencyId, createdAt: { gte: start }, status: { notIn: ['REJECTED','CANCELLED','FAILED'] } }, _sum: { amount: true } });
    if ((day._sum.amount ?? 0n) + amount > BigInt(policy.dailyWithdrawalLimit)) throw AppError.conflict('Vượt hạn mức rút tiền trong ngày.');
    const rows = await bookingBalances(tx, agencyId);
    if (rows.some(row => row.balance < 0n)) throw AppError.conflict('Có khoản công nợ cần kiểm tra trước khi rút.');
    const available = rows.filter(r => r.account === 'AGENCY_AVAILABLE' && r.balance > 0n).sort((a, b) => a.bookingId.localeCompare(b.bookingId));
    let need = amount;
    const allocations: { bookingId: string; amount: bigint }[] = [];
    for (const row of available) {
      const check = await conditions(tx, row.bookingId);
      if (check.reasons.length) continue;
      const used = row.balance < need ? row.balance : need;
      if (used) allocations.push({ bookingId: row.bookingId, amount: used });
      need -= used; if (!need) break;
    }
    if (need) throw AppError.conflict('Số dư đủ điều kiện không đủ để rút.');
    const w = await tx.agencyWithdrawal.create({ data: { agencyId, amount, requestKey, requestedBy: actorId,
      bankSnapshot: asJson({ bankName: bank.bankName, accountHolder: bank.accountHolder, last4: bank.last4, version: bank.version, encryptedDetails: bank.encryptedDetails, keyVersion: bank.keyVersion }) } });
    for (const item of allocations) {
      await tx.agencyWithdrawalAllocation.create({ data: { withdrawalId: w.id, ...item } });
      await move(tx, agencyId, item.bookingId, item.amount, 'AGENCY_AVAILABLE', 'AGENCY_RESERVED', `withdrawal-reserve:${w.id}:${item.bookingId}`, 'Dành số dư cho yêu cầu rút tiền', actorId);
    }
    await auditFinance(tx, agencyId, actorId, 'WITHDRAWAL_REQUESTED', w.id, { amount: String(amount), policyVersionId: policy.id });
    const admins = await tx.user.findMany({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', staffStatus: 'ACTIVE' }, select: { id: true }, take: 100 });
    for (const admin of admins) await writeNotification(tx, admin.id, { type: 'FINANCE_WITHDRAWAL_REQUESTED', title: 'Có yêu cầu rút tiền Agency', body: `Yêu cầu ${w.id.slice(0, 8)}: ${amount.toLocaleString('vi-VN')} đ.`, data: { href: `/super-admin/finance?view=withdrawals&agencyId=${agencyId}` } });
    return safeWithdrawal(w);
  }, { timeout: 20000 });
}

type WithdrawalRow = Awaited<ReturnType<typeof prisma.agencyWithdrawal.findUniqueOrThrow>>;
export function safeWithdrawal(w: WithdrawalRow) {
  const bank = w.bankSnapshot as { bankName: string; accountHolder: string; last4: string; version: number };
  return { ...w, bankSnapshot: { bankName: bank.bankName, accountHolder: bank.accountHolder, last4: bank.last4, version: bank.version } };
}
export async function changeWithdrawal(id: string, actorId: string, action: 'approve' | 'process' | 'complete' | 'reject' | 'cancel' | 'fail', input: { note?: string; bankRef?: string; proofId?: string; transferredAt?: string; amount?: string } = {}, agencyId?: string, ctx?: AgencyContext) {
  return prisma.$transaction(async tx => {
    const initial = await tx.agencyWithdrawal.findFirst({ where: { id, ...(agencyId ? { agencyId } : {}) } });
    if (!initial) throw AppError.notFound();
    if (ctx) await lockAgencyAccess(tx, ctx, P.FINANCE_WITHDRAW); else await lockAgency(tx, initial.agencyId);
    const w = await tx.agencyWithdrawal.findUniqueOrThrow({ where: { id } });
    if (agencyId && action !== 'cancel') throw AppError.forbidden();
    const required: Record<string, string[]> = { approve: ['PENDING'], process: ['APPROVED'], complete: ['PROCESSING'], reject: ['PENDING','APPROVED'], cancel: ['PENDING'], fail: ['PROCESSING'] };
    if (!required[action]!.includes(w.status)) throw AppError.conflict('Yêu cầu đã thay đổi trạng thái. Tải lại để kiểm tra.');
    if (action === 'approve' && w.requestedBy === actorId) throw AppError.forbidden('Người lập không được tự duyệt yêu cầu.');
    if (['complete','fail'].includes(action)) {
      if (w.processedBy !== actorId) throw AppError.forbidden('Chỉ người nhận xử lý được xác nhận kết quả chuyển.');
    }
    const allocations = await tx.agencyWithdrawalAllocation.findMany({ where: { withdrawalId: id } });
    if (total(allocations.map(a => a.amount)) !== w.amount) throw AppError.conflict('Bảng kê không khớp số tiền yêu cầu.');
    if (['approve','process','complete'].includes(action)) {
      const bank = await tx.agencyFinanceBank.findUnique({ where: { agencyId: w.agencyId } });
      if (!bank?.verifiedAt || bank.version !== (w.bankSnapshot as { version: number }).version) throw AppError.conflict('Ngân hàng đã thay đổi hoặc chưa xác minh.');
      for (const item of allocations) if ((await conditions(tx, item.bookingId)).reasons.length) throw AppError.conflict('Có khoản nguồn đang bị giữ; cần kiểm tra trước khi chuyển tiền.');
    }
    if (['reject','fail'].includes(action) && !input.note?.trim()) throw AppError.badRequest('Cần ghi lý do xử lý.');
    if (['complete','fail'].includes(action)) {
      if(input.bankRef){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agency-bank-reference:${input.bankRef}`}))`;if(await tx.agencyWithdrawal.findUnique({where:{bankRef:input.bankRef}}))throw AppError.conflict('Mã chuyển khoản đã được dùng.');}
      if (action === 'complete' && (!input.amount || positiveMoney(input.amount) !== w.amount)) throw AppError.badRequest('Số tiền chuyển phải khớp yêu cầu rút.');
      if (!input.bankRef || !input.proofId || !await tx.agencyFinanceDocument.findFirst({ where: { id: input.proofId, agencyId: w.agencyId } })) throw AppError.badRequest('Cần mã tham chiếu và chứng từ của đúng Agency.');
      if (!input.transferredAt || new Date(input.transferredAt) > new Date() || new Date(input.transferredAt) < w.createdAt) throw AppError.badRequest('Thời điểm chuyển không hợp lệ.');
      if (await tx.agencyPayout.findUnique({ where: { bankRef: input.bankRef } })) throw AppError.conflict('Mã chuyển khoản đã được dùng.');
    }
    if (action === 'complete') {
      for (const item of allocations) await post(tx, { agencyId: w.agencyId, bookingId: item.bookingId, type: 'PAYOUT', amount: item.amount, eventKey: `withdrawal-paid:${id}:${item.bookingId}`, actorId, effectiveAt: new Date(input.transferredAt!), description: 'Chuyển tiền theo yêu cầu rút' }, [
        { account: 'AGENCY_RESERVED', debit: item.amount, credit: 0n }, { account: 'PLATFORM_CASH', debit: 0n, credit: item.amount },
      ]);
    } else if (['reject','cancel','fail'].includes(action)) {
      for (const item of allocations) {
        const blocked = (await conditions(tx, item.bookingId)).reasons.length > 0;
        await move(tx, w.agencyId, item.bookingId, item.amount, 'AGENCY_RESERVED', blocked ? 'AGENCY_FROZEN' : 'AGENCY_AVAILABLE', `withdrawal-release:${id}:${item.bookingId}`, 'Giải phóng dự trữ yêu cầu rút', actorId);
      }
    }
    const status = { approve: 'APPROVED', process: 'PROCESSING', complete: 'COMPLETED', reject: 'REJECTED', cancel: 'CANCELLED', fail: 'FAILED' }[action];
    const updated = await tx.agencyWithdrawal.update({ where: { id }, data: { status, ...(action === 'approve' ? { approvedBy: actorId } : {}), ...(action === 'process' ? { processedBy: actorId } : {}),
      ...(input.note ? { note: input.note } : {}), ...(['complete','fail'].includes(action) ? { bankRef: input.bankRef, proofId: input.proofId, transferredAt: new Date(input.transferredAt!) } : {}), ...(action === 'complete' ? { completedAt: new Date() } : {}) } });
    await auditFinance(tx, w.agencyId, actorId, `WITHDRAWAL_${status}`, id, { amount: String(w.amount), note: input.note ?? null });
    await writeAgencyNotification(tx, w.agencyId, { type: 'FINANCE_WITHDRAWAL_UPDATED', title: 'Yêu cầu rút tiền đã cập nhật', body: `Yêu cầu ${id.slice(0,8)}: ${{ APPROVED:'đã duyệt',PROCESSING:'đang chuyển',COMPLETED:'đã chuyển',REJECTED:'bị từ chối',CANCELLED:'đã hủy',FAILED:'chuyển thất bại' }[status] ?? status}.`, data: { href: '/agency/finance?tab=withdrawals', withdrawalId: id } }, false);
    return safeWithdrawal(updated);
  }, { timeout: 20000 });
}

export async function settlementRows(agencyId: string, page = 1, pageSize = 25) {
  const [rows, count] = await prisma.$transaction([prisma.agencySettlement.findMany({ where: { agencyId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page-1)*pageSize, take: pageSize }), prisma.agencySettlement.count({ where: { agencyId } })]);
  const bookings = await prisma.booking.findMany({ where: { id: { in: rows.map(r => r.bookingId) } }, select: { id: true, bookingCode: true, tourTitle: true, agencyAmount: true } });
  return { items: rows.map(r => ({ ...r, booking: bookings.find(b => b.id === r.bookingId), reasonLabels: (r.reasons as string[]).map(k => reasonLabels[k] ?? k) })), total: count, page, pageSize };
}
export async function manualHold(settlementId:string,actorId:string,hold:boolean,note:string){
  if(note.trim().length<3)throw AppError.badRequest('Cần ghi rõ lý do giữ hoặc giải phóng tiền.');
  const s=await prisma.agencySettlement.findUnique({where:{id:settlementId}});if(!s)throw AppError.notFound();
  await prisma.$transaction(async tx=>{
    await lockAgency(tx,s.agencyId);
    const prior=await tx.agencyFinanceAudit.findFirst({where:{agencyId:s.agencyId,entityId:s.bookingId,action:{in:['MANUAL_FINANCE_HOLD','MANUAL_FINANCE_RELEASE']}},orderBy:[{createdAt:'desc'},{id:'desc'}]});
    await tx.agencyFinanceAudit.create({data:{agencyId:s.agencyId,actorId,entityId:s.bookingId,action:hold?'MANUAL_FINANCE_HOLD':'MANUAL_FINANCE_RELEASE',details:{note:note.trim(),settlementId},createdAt:new Date(Math.max(Date.now(),(prior?.createdAt.getTime()??0)+1))}});
  });
  return evaluateSettlement(s.bookingId);
}
export async function withdrawalRows(agencyId?: string, page = 1, status?: string, overdue=false) {
  const where:Prisma.AgencyWithdrawalWhereInput = { ...(agencyId ? { agencyId } : {}), ...(status ? { status } : {}) };
  if(overdue){const policy=await activePolicy(prisma);where.createdAt={lt:new Date(Date.now()-(policy?.processingHours??48)*3600000)};where.AND=[{status:{in:['PENDING','APPROVED','PROCESSING']}}];}
  const [items, count] = await prisma.$transaction([prisma.agencyWithdrawal.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page-1)*25 }), prisma.agencyWithdrawal.count({ where })]);
  return { items: items.map(safeWithdrawal), total: count, page, pageSize: 25 };
}
export { walletAccounts };
