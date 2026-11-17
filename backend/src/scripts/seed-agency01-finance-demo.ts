/** Explicit demo intake for the existing Agency01 test organization. No gateway or bank calls. */
import PDFDocument from 'pdfkit';
import { prisma, disconnectDatabase } from '../config/database';
import { auditFinance, documentHash, lockAgency, post } from '../modules/agency-finance/finance.service';

const PREFIX = 'TRP-TEST-FINANCE-';
const TITLE = '[TEST-FINANCE] Đà Nẵng — Dữ liệu kế toán mẫu';

async function demoProof(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.on('error', reject);
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.fontSize(22).text('TEST-FINANCE / DEMO ONLY');
    pdf.moveDown().fontSize(12).text('Sample attachment for Agency01 finance UI testing.');
    pdf.moveDown().text('This is not a bank receipt. No money has been transferred.');
    pdf.end();
  });
}

async function main() {
  if (process.argv[2] !== '--apply-agency01-demo') throw new Error('Explicit --apply-agency01-demo is required.');
  const owner = await prisma.user.findFirstOrThrow({ where: { email: { equals: 'agency01@tripri.test', mode: 'insensitive' }, role: 'AGENCY' } });
  const agency = await prisma.agencyProfile.findUniqueOrThrow({ where: { userId: owner.id } });
  if (!agency.companyName?.includes('Test')) throw new Error('Refusing a non-test organization.');
  const travelers = await prisma.user.findMany({ where: { email: { in: ['traveler01@tripri.test', 'traveler02@tripri.test', 'traveler03@tripri.test'] }, role: 'TRAVELER' } });
  if (travelers.length !== 3) throw new Error('Expected the three existing test travelers.');
  travelers.sort((a, b) => a.email.localeCompare(b.email));
  const proofBytes = await demoProof();
  const now = new Date();
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000);

  await prisma.$transaction(async tx => {
    await lockAgency(tx, agency.id);
    // Financial postings are immutable. A repeat run preserves the entire existing batch.
    const prior = await tx.booking.findMany({ where: { bookingCode: { startsWith: PREFIX } }, select: { agencyId: true } });
    if (prior.length) {
      if (prior.length !== 5 || prior.some(b => b.agencyId !== agency.id)) throw new Error('Existing fixture is incomplete or belongs to another agency; refusing changes.');
      return;
    }
    const source = await tx.tour.findFirst({ where: { agencyId: agency.id }, select: { images: true } });
    const tour = await tx.tour.create({ data: { agencyId: agency.id, title: TITLE, summary: 'Dữ liệu mô phỏng kế toán, không phải giao dịch ngân hàng.', destination: 'Đà Nẵng', durationDays: 2, basePrice: 2400000n, maxGroupSize: 20, status: 'DRAFT', visibility: 'PRIVATE', images: source?.images ?? [] } });
    const departure = await tx.tourDeparture.create({ data: { tourId: tour.id, date: day(-2), capacity: 20, remaining: 11, isOpen: false } });
    const amounts = [6000000n, 3600000n, 7200000n, 4800000n, 2400000n];
    const counts = [3, 2, 4, 2, 1];
    const bookings: string[] = [];
    for (let i = 0; i < amounts.length; i++) {
      const traveler = travelers[i % travelers.length]!;
      const amount = amounts[i]!, commission = amount / 10n, paidAt = day(-6 + i);
      const refundAmount = i === 3 ? 1200000n : i === 4 ? 600000n : null;
      const b = await tx.booking.create({ data: {
        bookingCode: `${PREFIX}${String(i + 1).padStart(3, '0')}`, travelerId: traveler.id, agencyId: agency.id, tourId: tour.id, departureId: departure.id,
        tourTitle: TITLE, departureDate: departure.date, endDate: day(-1), participants: counts[i]!, contactName: traveler.fullName, contactPhone: '0900000000',
        notes: '[TEST-FINANCE] Số liệu mô phỏng. Không thu/chuyển tiền thật.', unitPrice: amount / BigInt(counts[i]!), subtotal: amount, totalAmount: amount,
        commissionBps: 1000, commissionAmount: commission, agencyAmount: amount - commission,
        status: refundAmount ? 'CANCELLED' : 'CONFIRMED', isPaid: true, confirmedAt: paidAt, refundRequired: !!refundAmount, refundAmount,
        cancelledAt: refundAmount ? day(-1) : null, cancelNote: refundAmount ? '[TEST-FINANCE] Mẫu nghĩa vụ hoàn tiền để kiểm tra UI.' : null,
        fulfillmentStatus: 'COMPLETED', createdAt: paidAt,
      } });
      bookings.push(b.id);
      const payment = await tx.payment.create({ data: {
        purpose: 'BOOKING', userId: traveler.id, referenceId: b.id, amount, currency: 'VND', provider: 'TEST-FINANCE',
        description: '[TEST-FINANCE] Khoản thu mô phỏng; không phải PayOS.', providerOrderCode: BigInt(Date.now()) * 1000n + BigInt(i),
        status: 'PAID', paidAt, expiresAt: now, fulfilledAt: now,
      } });
      await tx.agencyFinanceReceipt.create({ data: { paymentId: payment.id, agencyId: agency.id, bookingId: b.id, amount, currency: 'VND', paidAt } });
      await post(tx, { agencyId: agency.id, bookingId: b.id, bookingCode: b.bookingCode, type: 'PAYMENT', amount, eventKey: `booking-receipt:${b.id}`, actorId: owner.id, effectiveAt: paidAt, description: '[TEST-FINANCE] Khách thanh toán mô phỏng' }, [
        { account: 'PLATFORM_CASH', debit: amount, credit: 0n },
        { account: 'AGENCY_PAYABLE', debit: 0n, credit: amount - commission },
        { account: 'PLATFORM_COMMISSION', debit: 0n, credit: commission },
      ]);
      await tx.financeOutbox.update({ where: { paymentId: payment.id }, data: { processedAt: now } });
    }
    const proof = await tx.agencyFinanceDocument.create({ data: { agencyId: agency.id, actorId: owner.id, name: 'TEST-FINANCE-khong-phai-chung-tu-ngan-hang.pdf', mimeType: 'application/pdf', data: new Uint8Array(proofBytes), sha256: documentHash(proofBytes) } });
    await tx.agencyManualRefund.create({ data: { agencyId: agency.id, bookingId: bookings[4]!, amount: 300000n, paidBy: 'AGENCY', transferredAt: day(-1), bankRef: 'TEST-FINANCE-DEMO-REFUND-001', proofId: proof.id, reason: '[TEST-FINANCE] Mẫu chờ kiểm tra; chưa có chuyển khoản thật.', requestKey: 'test-finance-refund-001', actorId: owner.id } });
    const payout = await tx.agencyPayout.create({ data: { agencyId: agency.id, periodStart: day(-10), periodEnd: now, totalGmv: amounts[0]!, platformCommission: amounts[0]! / 10n, netPayoutAmount: amounts[0]! * 9n / 10n, status: 'CANCELLED', bankSnapshot: { bankName: 'Ngân hàng mô phỏng (TEST)', accountHolder: 'TEST-FINANCE — Không chuyển tiền', last4: '0000', demo: true }, preparedBy: owner.id, items: { create: { bookingId: bookings[0]!, amount: amounts[0]! * 9n / 10n } } } });
    await auditFinance(tx, agency.id, owner.id, 'TEST_FIXTURE_CREATED', payout.id, { demo: true, prefix: PREFIX, description: '5 simulated receipts, 2 refund obligations, 1 pending refund, 1 cancelled payout. No bank verification, policy changes, transfers or PayOS calls.' });
  }, { timeout: 60000, maxWait: 15000 });
  const result = await prisma.booking.aggregate({ where: { agencyId: agency.id, bookingCode: { startsWith: PREFIX } }, _count: true, _sum: { totalAmount: true, commissionAmount: true, refundAmount: true } });
  console.log(JSON.stringify({ account: owner.email, ...result }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(disconnectDatabase);
