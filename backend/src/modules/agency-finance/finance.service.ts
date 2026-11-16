import { createHash } from 'node:crypto';
import { prisma, type DbExecutor } from '../../config/database';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../utils/app-error';
import { createPayosProviderFromEnv } from '../payments/providers/payos.provider';
import type { PaymentProvider } from '../payments/providers/payment.provider';
import { assertBalanced, positiveMoney, refundSplit, type Posting } from './finance.rules';

const sum = (values: bigint[]) => values.reduce((s, v) => s + v, 0n);
export const auditFinance = (tx: DbExecutor, agencyId: string, actorId: string, action: string, entityId: string, details: Prisma.InputJsonValue = {}) =>
  tx.agencyFinanceAudit.create({ data: { agencyId, actorId, action, entityId, details } });
// All money-changing paths serialize per organization. Locks release with the transaction.
export async function lockAgency(tx: DbExecutor, agencyId: string) {
  await tx.$queryRaw`SELECT id FROM "AgencyProfile" WHERE id = ${agencyId}::uuid FOR UPDATE`;
}
export async function post(tx: DbExecutor, data: { agencyId: string; bookingId?: string; bookingCode?: string; type: string; amount: bigint; eventKey: string; actorId?: string; effectiveAt: Date; description: string }, entries: Posting[]) {
  assertBalanced(entries);
  return tx.agencyTransaction.upsert({ where: { eventKey: data.eventKey }, update: {}, create: { ...data, entries: { create: entries } } });
}
export async function drainFinanceOutbox() {
  const pending = await prisma.financeOutbox.findMany({ where: { processedAt: null }, take: 100, orderBy: { createdAt: 'asc' }, include: { payment: true } });
  for (const event of pending) await prisma.$transaction(async tx => {
    const p = event.payment;
    const b = await tx.booking.findUnique({ where: { id: p.referenceId } });
    if (b && p.purpose === 'BOOKING' && p.status === 'PAID' && p.currency === 'VND') {
      await lockAgency(tx, b.agencyId);
      await tx.agencyFinanceReceipt.upsert({ where: { paymentId: p.id }, update: {}, create: {
        paymentId: p.id, agencyId: b.agencyId, bookingId: b.id, amount: p.amount, currency: p.currency, paidAt: p.paidAt ?? p.updatedAt,
      } });
      // A receipt is known, but remains non-payable until independently reconciled.
      // One commercial sale per booking: additional paid attempts stay in receipts as exceptions.
      if (p.amount === b.totalAmount && b.commissionAmount + b.agencyAmount === b.totalAmount) {
        await post(tx, { agencyId: b.agencyId, bookingId: b.id, bookingCode: b.bookingCode, type: 'PAYMENT', amount: p.amount,
          eventKey: `booking-receipt:${b.id}`, effectiveAt: p.paidAt ?? p.updatedAt, description: 'Khách thanh toán đặt chỗ' }, [
          { account: 'PLATFORM_CASH', debit: p.amount, credit: 0n },
          { account: 'AGENCY_PAYABLE', debit: 0n, credit: b.agencyAmount },
          { account: 'PLATFORM_COMMISSION', debit: 0n, credit: b.commissionAmount },
        ]);
      }
    }
    await tx.financeOutbox.update({ where: { paymentId: p.id }, data: { processedAt: new Date() } });
  });
  return pending.length;
}

export async function reconcileRun(runId: string, provider: PaymentProvider = createPayosProviderFromEnv()) {
  const run = await prisma.agencyReconciliationRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== 'PENDING') return;
  const claimed = await prisma.agencyReconciliationRun.updateMany({ where: { id: runId, status: 'PENDING' }, data: { status: 'PROCESSING' } });
  if (!claimed.count) return;
  // A bounded run; subsequent runs continue with the least recently checked receipts.
  const rows = await prisma.agencyFinanceReceipt.findMany({ where: { agencyId: run.agencyId }, include: { payment: true, booking: true }, orderBy: [{ checkedAt: { sort: 'asc', nulls: 'first' } }, { paymentId: 'asc' }], take: 100 });
  let matched = 0, discrepancies = 0, errors = 0;
  for (const row of rows) {
    try {
      if (row.payment.provider.toLowerCase() !== provider.name.toLowerCase()) throw new Error('Khác cổng thanh toán.');
      const order = row.payment.providerOrderCode;
      if (order > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Mã thanh toán vượt miền hỗ trợ.');
      const remote = await provider.getPaymentStatus(Number(order));
      const actual = BigInt(remote.amountPaid);
      const transactions = remote.transactions ?? [];
      const refs = transactions.map(t => t.reference);
      const hasProof = transactions.length > 0 && refs.every(Boolean) && new Set(refs).size === refs.length &&
        transactions.every(t => t.currency === 'VND') && sum(transactions.map(t => BigInt(t.amount))) === actual;
      const duplicatePaid = await prisma.payment.count({ where: { purpose: 'BOOKING', referenceId: row.bookingId, status: 'PAID' } }) > 1;
      const reason = duplicatePaid ? 'MULTIPLE_PAID_PAYMENTS' : row.amount !== row.booking.totalAmount ? 'BOOKING_AMOUNT_MISMATCH' :
        remote.paymentLinkId !== row.payment.providerPaymentLinkId ? 'PAYMENT_LINK_MISMATCH' : actual !== row.amount ? 'AMOUNT_MISMATCH' :
        remote.state !== 'PAID' ? 'GATEWAY_NOT_PAID' : !hasProof ? 'MISSING_TRANSACTION_EVIDENCE' : null;
      const status = reason === null ? 'MATCHED' : reason === 'MISSING_TRANSACTION_EVIDENCE' || reason === 'GATEWAY_NOT_PAID' ? 'UNRECONCILED' : 'DISCREPANCY';
      if (status === 'MATCHED') matched++; else if (status === 'DISCREPANCY') discrepancies++;
      await prisma.$transaction(async tx => {
        await lockAgency(tx, row.agencyId);
        await tx.agencyGatewayObservation.create({ data: { paymentId: row.paymentId, runId, amount: actual, state: status, reason, evidence: JSON.parse(JSON.stringify(remote)) } });
        await tx.agencyFinanceReceipt.update({ where: { paymentId: row.paymentId }, data: { actualAmount: actual, reconciliationStatus: status, reason, gatewayRef: refs.join(', ').slice(0, 2000) || null, checkedAt: new Date() } });
      });
    } catch {
      errors++;
      // Keep the historical evidence, but invalidate current eligibility after a failed check.
      await prisma.agencyFinanceReceipt.update({ where: { paymentId: row.paymentId }, data: { reconciliationStatus: 'UNRECONCILED', reason: 'PROVIDER_UNAVAILABLE', checkedAt: new Date() } });
    }
  }
  await prisma.agencyReconciliationRun.update({ where: { id: runId }, data: { status: errors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', checked: rows.length, matched, discrepancies, errors, completedAt: new Date() } });
}
export async function processFinanceJobs() {
  await drainFinanceOutbox();
  // A crashed run is safely retryable: reconciliation has no transfer side effects.
  await prisma.agencyReconciliationRun.updateMany({ where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 3600000) } }, data: { status: 'PENDING' } });
  const runs = await prisma.agencyReconciliationRun.findMany({ where: { status: 'PENDING' }, take: 2, orderBy: { createdAt: 'asc' } });
  for (const run of runs) await reconcileRun(run.id);
}

export async function refundRows(agencyId: string) {
  const rows = await prisma.booking.findMany({ where: { agencyId, refundRequired: true, isPaid: true }, orderBy: { updatedAt: 'desc' }, take: 200,
    select: { id: true, bookingCode: true, tourTitle: true, totalAmount: true, refundAmount: true, financeRefunds: { orderBy: { createdAt: 'desc' } } } });
  return rows.map(b => ({ ...b, approvedAmount: BigInt(b.refundAmount ?? 0), recordedAmount: sum(b.financeRefunds.filter(r => r.status !== 'REJECTED').map(r => r.amount)), confirmedAmount: sum(b.financeRefunds.filter(r => r.status === 'CONFIRMED').map(r => r.amount)) }));
}
export async function recordRefund(agencyId: string, actorId: string, bookingId: string, input: {
  amount: string; paidBy: 'AGENCY' | 'PLATFORM'; transferredAt: string; bankRef: string; proofId: string; reason: string; requestKey: string;
}) {
  const amount = positiveMoney(input.amount);
  if (new Date(input.transferredAt) > new Date()) throw AppError.badRequest('Ngày hoàn không được ở tương lai.');
  return prisma.$transaction(async tx => {
    await lockAgency(tx, agencyId);
    const previous = await tx.agencyManualRefund.findUnique({ where: { agencyId_requestKey: { agencyId, requestKey: input.requestKey } } });
    if (previous) {
      if (previous.bookingId !== bookingId || previous.amount !== amount || previous.bankRef !== input.bankRef || previous.paidBy !== input.paidBy || previous.proofId !== input.proofId)
        throw AppError.conflict('Mã yêu cầu đã dùng cho nội dung khác.');
      return previous;
    }
    const booking = await tx.booking.findFirst({ where: { id: bookingId, agencyId, isPaid: true, refundRequired: true } });
    if (!booking || !booking.refundAmount) throw AppError.badRequest('Booking chưa có số tiền hoàn được xác định.');
    if (!await tx.agencyFinanceDocument.findFirst({ where: { id: input.proofId, agencyId } })) throw AppError.notFound('Không tìm thấy chứng từ.');
    const reserved = await tx.agencyManualRefund.aggregate({ where: { bookingId, status: { not: 'REJECTED' } }, _sum: { amount: true } });
    if (amount + (reserved._sum.amount ?? 0n) > BigInt(booking.refundAmount) || amount + (reserved._sum.amount ?? 0n) > booking.totalAmount)
      throw AppError.badRequest('Tổng tiền ghi nhận vượt nghĩa vụ hoàn còn lại.');
    const refund = await tx.agencyManualRefund.create({ data: { ...input, amount, transferredAt: new Date(input.transferredAt), agencyId, bookingId, actorId } });
    await auditFinance(tx, agencyId, actorId, 'REFUND_RECORDED', refund.id, { bookingId, paidBy: input.paidBy, amount: amount.toString() });
    return refund;
  });
}
export async function reviewRefund(id: string, actorId: string, confirm: boolean, note: string) {
  return prisma.$transaction(async tx => {
    const found = await tx.agencyManualRefund.findUniqueOrThrow({ where: { id } });
    await lockAgency(tx, found.agencyId);
    const refund = await tx.agencyManualRefund.findUniqueOrThrow({ where: { id }, include: { booking: true } });
    if (refund.status !== 'PENDING') throw AppError.conflict('Bản ghi đã được xử lý.');
    if (refund.actorId === actorId) throw AppError.forbidden('Người nhập không được tự xác nhận chứng từ.');
    let fee = 0n;
    if (confirm) {
      const policy = await tx.agencyFinancePolicy.findUnique({ where: { id: 'default' } });
      if (policy?.refundCommissionPolicy !== 'PROPORTIONAL') throw AppError.conflict('Chưa cấu hình chính sách phân bổ hoàn tiền.');
      const receipt = await tx.agencyFinanceReceipt.findFirst({ where: { bookingId: refund.bookingId, reconciliationStatus: 'MATCHED' } });
      if (!receipt) throw AppError.conflict('Cần đối soát khoản thu trước khi xác nhận hoàn.');
      const previous = await tx.agencyManualRefund.aggregate({ where: { bookingId: refund.bookingId, status: 'CONFIRMED' }, _sum: { amount: true } });
      const prev = previous._sum.amount ?? 0n;
      if (prev + refund.amount > BigInt(refund.booking.refundAmount ?? 0)) throw AppError.conflict('Nghĩa vụ hoàn đã thay đổi.');
      const split = refundSplit(refund.booking.totalAmount, refund.booking.commissionAmount, prev, refund.amount); fee = split.commission;
      await post(tx, { agencyId: refund.agencyId, bookingId: refund.bookingId, bookingCode: refund.booking.bookingCode, type: 'REFUND', amount: refund.amount,
        eventKey: `manual-refund:${id}`, actorId, effectiveAt: refund.transferredAt, description: refund.reason }, [
        { account: 'AGENCY_PAYABLE', debit: split.agency, credit: 0n },
        { account: 'PLATFORM_COMMISSION', debit: split.commission, credit: 0n },
        { account: refund.paidBy === 'AGENCY' ? 'AGENCY_PAYABLE' : 'PLATFORM_CASH', debit: 0n, credit: refund.amount },
      ]);
    }
    const result = await tx.agencyManualRefund.update({ where: { id }, data: { status: confirm ? 'CONFIRMED' : 'REJECTED', commissionReversal: fee, reviewedBy: actorId, reviewedAt: new Date(), reviewNote: note } });
    await auditFinance(tx, refund.agencyId, actorId, confirm ? 'REFUND_CONFIRMED' : 'REFUND_REJECTED', id, { note });
    return result;
  });
}

// Must be called under the agency lock for any reservation/transfer operation.
export async function eligibleBalances(tx: DbExecutor, agencyId: string, now = new Date()) {
  const policy = await tx.agencyFinancePolicy.findUnique({ where: { id: 'default' } });
  if (!policy) return [];
  return tx.$queryRaw<{ bookingId: string; bookingCode: string; totalAmount: bigint; commissionAmount: bigint; available: bigint }[]>`
    SELECT b.id AS "bookingId", b."bookingCode", b."totalAmount", b."commissionAmount",
      b."agencyAmount" - COALESCE(r.deduction,0) - COALESCE(p.reserved,0) AS available
    FROM "Booking" b
    JOIN "TourCompletion" c ON c."departureId" = b."departureId" AND c."agencyId" = b."agencyId" AND c."tourId" = b."tourId"
    LEFT JOIN LATERAL (SELECT SUM(CASE WHEN f."paidBy" = 'AGENCY' THEN -f."commissionReversal" ELSE f.amount-f."commissionReversal" END)::bigint AS deduction
      FROM "AgencyManualRefund" f WHERE f."bookingId" = b.id AND f.status = 'CONFIRMED') r ON true
    LEFT JOIN LATERAL (SELECT SUM(i.amount)::bigint AS reserved FROM "AgencyPayoutItem" i JOIN "AgencyPayout" p ON p.id=i."payoutId"
      WHERE i."bookingId"=b.id AND p.status <> 'CANCELLED') p ON true
    WHERE b."agencyId"=${agencyId}::uuid AND b.status='COMPLETED' AND b."isPaid"=true
      AND b."endDate" <= ${now} AND c."completedAt" <= ${new Date(now.getTime() - policy.holdDays * 86400000)}
      AND EXISTS (SELECT 1 FROM "TourCompletionReport" cr WHERE cr."completionId"=c.id AND cr.submitted)
      AND (SELECT COUNT(*) FROM "Payment" pay WHERE pay.purpose='BOOKING' AND pay."referenceId"=b.id AND pay.status='PAID')=1
      AND EXISTS (SELECT 1 FROM "AgencyFinanceReceipt" x WHERE x."bookingId"=b.id AND x."reconciliationStatus"='MATCHED')
      AND NOT EXISTS (SELECT 1 FROM "ComplaintTicket" ct WHERE ct."bookingId"=b.id AND ct.status NOT IN ('RESOLVED','CLOSED'))
      AND NOT EXISTS (SELECT 1 FROM "AgencyManualRefund" f WHERE f."bookingId"=b.id AND f.status='PENDING')
      AND (NOT b."refundRequired" OR (b."refundAmount" IS NOT NULL AND COALESCE((SELECT SUM(f.amount) FROM "AgencyManualRefund" f WHERE f."bookingId"=b.id AND f.status='CONFIRMED'),0)>=b."refundAmount"))
      AND b."agencyAmount" - COALESCE(r.deduction,0) - COALESCE(p.reserved,0) > 0
    ORDER BY b.id LIMIT 1000`;
}
export async function preparePayout(agencyId: string, actorId: string, start: Date, end: Date) {
  return prisma.$transaction(async tx => {
    await lockAgency(tx, agencyId);
    const bank = await tx.agencyFinanceBank.findUnique({ where: { agencyId } });
    const agency = await tx.agencyProfile.findUniqueOrThrow({ where: { id: agencyId } });
    if (!bank?.verifiedAt || agency.verificationStatus !== 'VERIFIED') throw AppError.conflict('Agency và tài khoản ngân hàng phải được xác minh.');
    const eligible = await eligibleBalances(tx, agencyId);
    const bookings = await tx.booking.findMany({ where: { id: { in: eligible.map(b => b.bookingId) }, completedAt: { gte: start, lt: end } }, select: { id: true } });
    const ids = new Set(bookings.map(b => b.id));
    const rows = eligible.filter(b => ids.has(b.bookingId));
    if (!rows.length) throw AppError.conflict('Không có khoản đủ điều kiện trong kỳ này.');
    const payout = await tx.agencyPayout.create({ data: { agencyId, periodStart: start, periodEnd: end, totalGmv: sum(rows.map(b => b.totalAmount)),
      platformCommission: sum(rows.map(b => b.commissionAmount)), netPayoutAmount: sum(rows.map(b => b.available)), preparedBy: actorId,
      bankSnapshot: { version: bank.version, bankName: bank.bankName, accountHolder: bank.accountHolder, last4: bank.last4, encryptedDetails: bank.encryptedDetails, keyVersion: bank.keyVersion },
      items: { create: rows.map(b => ({ bookingId: b.bookingId, amount: b.available })) } } });
    await auditFinance(tx, agencyId, actorId, 'PAYOUT_PREPARED', payout.id);
    return payout;
  });
}
export async function changePayout(id: string, actorId: string, action: 'approve' | 'cancel' | 'complete', input: { bankRef?: string; proofId?: string } = {}) {
  return prisma.$transaction(async tx => {
    const first = await tx.agencyPayout.findUniqueOrThrow({ where: { id } });
    await lockAgency(tx, first.agencyId);
    const p = await tx.agencyPayout.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (action === 'cancel') {
      if (p.status !== 'PENDING') throw AppError.conflict('Chỉ hủy kỳ chưa được duyệt.');
      const cancelled = await tx.agencyPayout.update({ where: { id }, data: { status: 'CANCELLED' } });
      await auditFinance(tx, p.agencyId, actorId, 'PAYOUT_CANCELLED', id); return cancelled;
    }
    if (action === 'approve' && p.status !== 'PENDING' || action === 'complete' && p.status !== 'PROCESSING') throw AppError.conflict('Trạng thái kỳ quyết toán không hợp lệ.');
    if (action === 'approve' && p.preparedBy === actorId) throw AppError.forbidden('Người lập không được tự duyệt kỳ quyết toán.');
    const bank = await tx.agencyFinanceBank.findUnique({ where: { agencyId: p.agencyId } });
    const snap = p.bankSnapshot as { version: number };
    if (!bank?.verifiedAt || bank.version !== snap.version) throw AppError.conflict('Thông tin ngân hàng đã thay đổi; cần kiểm tra lại kỳ.');
    // Revalidate with this reservation removed, without changing committed data.
    // Pending claims, new refunds or lost reconciliation stop approval and completion.
    const blockers = await tx.booking.count({ where: { id: { in: p.items.map(i => i.bookingId) }, OR: [ { status: { not: 'COMPLETED' } }, { financeRefunds: { some: { createdAt: { gt: p.createdAt }, status: { not: 'REJECTED' } } } }, { financeReceipts: { some: { reconciliationStatus: { not: 'MATCHED' } } } } ] } });
    const complaints = await tx.complaintTicket.count({ where: { bookingId: { in: p.items.map(i => i.bookingId) }, status: { notIn: ['RESOLVED', 'CLOSED'] } } });
    if (blockers || complaints) throw AppError.conflict('Có thay đổi hoàn tiền/đối soát/khiếu nại cần xử lý trước.');
    if (action === 'complete') {
      if (!input.bankRef || !input.proofId || !await tx.agencyFinanceDocument.findFirst({ where: { id: input.proofId, agencyId: p.agencyId } })) throw AppError.badRequest('Cần mã giao dịch và chứng từ chuyển tiền.');
      for (const item of p.items) await post(tx, { agencyId: p.agencyId, bookingId: item.bookingId, type: 'PAYOUT', amount: item.amount, eventKey: `payout:${id}:${item.bookingId}`, actorId, effectiveAt: new Date(), description: 'Ghi nhận quyết toán chuyển ngoài' }, [
        { account: 'AGENCY_PAYABLE', debit: item.amount, credit: 0n }, { account: 'PLATFORM_CASH', debit: 0n, credit: item.amount },
      ]);
    }
    const updated = await tx.agencyPayout.update({ where: { id }, data: action === 'approve' ? { status: 'PROCESSING', approvedBy: actorId } : { status: 'COMPLETED', completedBy: actorId, completedAt: new Date(), bankRef: input.bankRef, proofId: input.proofId } });
    await auditFinance(tx, p.agencyId, actorId, action === 'approve' ? 'PAYOUT_APPROVED' : 'PAYOUT_COMPLETED', id); return updated;
  });
}
export async function overview(agencyId: string, start: Date, end: Date) {
  return prisma.$transaction(async tx => {
    const entries = await tx.agencyLedgerEntry.findMany({ where: { transaction: { agencyId, effectiveAt: { lt: end } } }, include: { transaction: { select: { type: true, effectiveAt: true } } } });
    const balance = (account: string, before = end) => sum(entries.filter(e => e.account === account && e.transaction.effectiveAt < before).map(e => e.credit - e.debit));
    const period = entries.filter(e => e.transaction.effectiveAt >= start);
    const gmv = sum(period.filter(e => e.account === 'PLATFORM_CASH' && e.transaction.type === 'PAYMENT').map(e => e.debit));
    const commission = sum(period.filter(e => e.account === 'PLATFORM_COMMISSION').map(e => e.credit - e.debit));
    const payouts = sum(period.filter(e => e.account === 'AGENCY_PAYABLE' && e.transaction.type === 'PAYOUT').map(e => e.debit));
    const held = balance('AGENCY_PAYABLE');
    const eligible = await eligibleBalances(tx, agencyId);
    const refunds = await tx.booking.findMany({ where: { agencyId, isPaid: true, refundRequired: true }, select: { refundAmount: true, financeRefunds: { where: { status: 'CONFIRMED' }, select: { amount: true } } } });
    const liability = sum(refunds.map(b => { const v = BigInt(b.refundAmount ?? 0) - sum(b.financeRefunds.map(r => r.amount)); return v > 0n ? v : 0n; }));
    const unresolved = await tx.agencyFinanceReceipt.count({ where: { agencyId, reconciliationStatus: { not: 'MATCHED' } } });
    const buckets = new Map<string, { date: string; receipts: bigint; refunds: bigint; commission: bigint }>();
    for (const e of period) {
      const date = new Date(e.transaction.effectiveAt.getTime() + 25200000).toISOString().slice(0, 10);
      const b = buckets.get(date) ?? { date, receipts: 0n, refunds: 0n, commission: 0n };
      if (e.account === 'PLATFORM_CASH' && e.transaction.type === 'PAYMENT') b.receipts += e.debit;
      if (e.account === 'PLATFORM_CASH' && e.transaction.type === 'REFUND') b.refunds += e.credit;
      if (e.account === 'PLATFORM_COMMISSION') b.commission += e.credit - e.debit;
      buckets.set(date, b);
    }
    return { start, end, gmv, commission, agencyEntitlement: gmv - commission, held, available: sum(eligible.map(b => b.available)), paidOut: payouts,
      openingBalance: balance('AGENCY_PAYABLE', start), closingBalance: held, refundLiability: liability, unresolvedReceipts: unresolved,
      policyConfigured: !!await tx.agencyFinancePolicy.findUnique({ where: { id: 'default' } }), cashflow: [...buckets.values()].sort((a,b) => a.date.localeCompare(b.date)) };
  }, { isolationLevel: 'RepeatableRead' });
}
export const documentHash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
