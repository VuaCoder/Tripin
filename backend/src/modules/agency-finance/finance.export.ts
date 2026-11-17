import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import path from 'node:path';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
const fmt = (v: bigint) => new Intl.NumberFormat('vi-VN').format(v) + ' đ';
export function excelAmount(value: bigint): number | string { return value.toString().replace('-', '').length <= 15 ? Number(value) : value.toString(); }
export async function exportFinance(agencyId: string, start: Date, end: Date, format: 'xlsx' | 'pdf', origin?: 'LIVE'|'TEST'|'UNKNOWN') {
    const snapshot = await prisma.$transaction(async (tx) => {
        const agency = await tx.agencyProfile.findUnique({ where: { id: agencyId }, select: { companyName: true } });
        if (!agency) throw AppError.notFound();
        const where = { agencyId, effectiveAt: { gte: start, lt: end }, ...(origin?{booking:{financeReceipts:{some:{payment:{financeSource:{origin}}}}}}:{}) };
        const count = await tx.agencyTransaction.count({ where });
        if (count > 10000)
            throw AppError.badRequest('Báo cáo vượt 10.000 giao dịch. Hãy chọn khoảng ngày ngắn hơn.');
        const rows = await tx.agencyTransaction.findMany({ where, orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }], include: { entries: true } });
        const balances=await tx.$queryRaw<{opening:bigint}[]>`SELECT COALESCE(SUM(e.credit-e.debit),0)::bigint AS opening
          FROM "AgencyTransaction" t JOIN "AgencyLedgerEntry" e ON e."transactionId"=t.id
          WHERE t."agencyId"=${agencyId}::uuid AND e.account IN ('AGENCY_PAYABLE','AGENCY_AVAILABLE','AGENCY_RESERVED','AGENCY_FROZEN') AND t."effectiveAt"<${start}
            AND (${origin??null}::text IS NULL OR EXISTS(SELECT 1 FROM "Payment" p JOIN "AgencyFinanceSource" s ON s."paymentId"=p.id WHERE p.purpose='BOOKING' AND p."referenceId"=t."bookingId" AND s.origin=${origin??null}))`;
        return { agency, rows, opening:balances[0]?.opening??0n, asOf: new Date() };
    }, { isolationLevel: 'RepeatableRead' });
    const rows = snapshot.rows;
    const amounts = rows.map(r => r.amount), total = amounts.reduce((s, v) => s + v, 0n);
    const exact = amounts.every(v => typeof excelAmount(v) === 'number') && typeof excelAmount(total) === 'number';
    const entries=rows.flatMap(r=>r.entries.map(e=>({...e,type:r.type})));
    const sumEntries=(account:string,types:string[],side:'debit'|'credit'|'net')=>entries.filter(e=>e.account===account&&types.includes(e.type)).reduce((v,e)=>v+(side==='net'?e.credit-e.debit:e[side]),0n);
    const gmv=sumEntries('PLATFORM_CASH',['PAYMENT'],'debit');
    const commission=sumEntries('PLATFORM_COMMISSION',['PAYMENT','REFUND'],'net');
    const entitlement=sumEntries('AGENCY_PAYABLE',['PAYMENT'],'net')-sumEntries('AGENCY_PAYABLE',['REFUND'],'debit');
    const paid=sumEntries('PLATFORM_CASH',['PAYOUT'],'credit');
    const released=rows.filter(r=>r.eventKey.startsWith('settlement:')).reduce((v,r)=>v+r.amount,0n);
    const earned=sumEntries('PLATFORM_COMMISSION_EARNED',['ADJUSTMENT'],'net');
    const reimbursement=sumEntries('AGENCY_PAYABLE',['REFUND'],'credit');
    const closing=snapshot.opening+entries.filter(e=>['AGENCY_PAYABLE','AGENCY_AVAILABLE','AGENCY_RESERVED','AGENCY_FROZEN'].includes(e.account)).reduce((value,e)=>value+e.credit-e.debit,0n);
    const from = new Date(start.getTime() + 25200000).toISOString().slice(0, 10), to = new Date(end.getTime() - 1 + 25200000).toISOString().slice(0, 10);
    if (format === 'xlsx') {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Tripri';
        wb.created = snapshot.asOf;
        const summary = wb.addWorksheet('Tổng hợp');
        summary.columns = [{ width: 36 }, { width: 70 }];
        summary.addRows([['Agency', snapshot.agency.companyName], ['Từ ngày (UTC+7)', from], ['Đến ngày (UTC+7)', to], ['Đơn vị', 'VND'], ['Thời điểm xuất', snapshot.asOf.toISOString()], ['Số chứng từ', rows.length], ['Tổng giá trị chứng từ', exact ? Number(total) : total.toString()], ['Lưu ý', 'Tổng giá trị chứng từ không phải doanh thu; xem phân loại và các vế ghi sổ.'], ['Chế độ số', exact ? 'Số nguyên chính xác, có SUM' : 'Dạng text chính xác; tổng tính bằng BigInt, không dùng SUM.']]);
        summary.addRows([['GMV đã ghi sổ',excelAmount(gmv)],['Phần agency được hưởng',excelAmount(entitlement)],['Hoa hồng tạm tính, sau điều chỉnh',excelAmount(commission)],['Đã chuyển ngân hàng trong kỳ',excelAmount(paid)],['Bù agency chi hộ hoàn tiền',excelAmount(reimbursement)],['Phải trả agency đầu kỳ',excelAmount(snapshot.opening)],['Phải trả agency cuối kỳ',excelAmount(closing)]]);
        summary.addRows([['Đã giải phóng vào số dư',excelAmount(released)],['Hoa hồng đã ghi nhận',excelAmount(earned)],['Nguồn dữ liệu',origin??'Lịch sử đầy đủ']]);
        const sheet = wb.addWorksheet('Giao dịch');
        sheet.columns = [{ header: 'Ngày (UTC+7)', key: 'date', width: 22 }, { header: 'Mã booking', key: 'booking', width: 24 }, { header: 'Loại', key: 'type', width: 18 }, { header: 'Số tiền (VND)', key: 'amount', width: 24 }, { header: 'Nội dung', key: 'description', width: 55 }, { header: 'Mã chứng từ', key: 'id', width: 40 }];
        for (const r of rows)
            sheet.addRow({ date: new Date(r.effectiveAt.getTime() + 25200000).toISOString().replace('T', ' ').slice(0, 19), booking: r.bookingCode ?? '', type: r.type, amount: exact ? Number(r.amount) : r.amount.toString(), description: r.description, id: r.id });
        if (rows.length) {
            const last = sheet.addRow({ type: 'Tổng', amount: exact ? { formula: `SUM(D2:D${rows.length + 1})`, result: Number(total) } : total.toString() });
            last.font = { bold: true };
        }
        const ledger = wb.addWorksheet('Các vế ghi sổ');
        ledger.columns = [{ header: 'Mã chứng từ', width: 40 }, { header: 'Tài khoản', width: 28 }, { header: 'Nợ (VND)', width: 24 }, { header: 'Có (VND)', width: 24 }];
        for (const r of rows)
            for (const e of r.entries)
                ledger.addRow([r.id, e.account, excelAmount(e.debit), excelAmount(e.credit)]);
        for(const [name,type] of [['Hoàn tiền','REFUND'],['Quyết toán','PAYOUT']]){
          const sh=wb.addWorksheet(name!);sh.columns=[{header:'Mã booking',width:24},{header:'Ngày (UTC+7)',width:22},{header:'Số tiền (VND)',width:24},{header:'Nội dung',width:55},{header:'Mã chứng từ',width:40}];
          for(const r of rows.filter(r=>r.type===type))sh.addRow([r.bookingCode??'',new Date(r.effectiveAt.getTime()+25200000).toISOString().slice(0,19),excelAmount(r.amount),r.description,r.id]);
        }
        for (const s of wb.worksheets) {
            s.views = [{ state: 'frozen', ySplit: 1 }];
            s.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            s.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
            s.getRow(1).height = 26;
        }
        sheet.getColumn(4).numFmt = '#,##0';
        ledger.getColumn(3).numFmt = '#,##0';
        ledger.getColumn(4).numFmt = '#,##0';
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
    const resolve = createRequire(path.join(process.cwd(), 'package.json'));
    const font = resolve.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
    const pdf = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    const result = new Promise<Buffer>((resolve, reject) => { pdf.on('data', (v: Buffer) => chunks.push(v)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject); });
    pdf.font(font);
    const title = () => { pdf.fontSize(18).fillColor('#0f766e').text('TRIPRI · BÁO CÁO TÀI CHÍNH'); pdf.fontSize(11).fillColor('#0f172a').text(snapshot.agency.companyName ?? 'Agency').text(`${from} – ${to} · VND · UTC+7`).moveDown(); };
    title();
    pdf.fontSize(10).text(`GMV đã ghi sổ: ${fmt(gmv)}`).text(`Phần agency được hưởng: ${fmt(entitlement)}`).text(`Hoa hồng tạm tính: ${fmt(commission)}`).text(`Đã chuyển ngân hàng trong kỳ: ${fmt(paid)}`).text(`Phải trả đầu kỳ: ${fmt(snapshot.opening)} · Cuối kỳ: ${fmt(closing)}`).moveDown();
    pdf.text(`Đã giải phóng vào số dư: ${fmt(released)} · Hoa hồng đã ghi nhận: ${fmt(earned)}`).moveDown();
    pdf.text(`${rows.length} chứng từ · Tổng giá trị chứng từ: ${fmt(total)}`).text('Bảng kê nghiệp vụ, không phải hóa đơn thuế.').moveDown();
    for (const row of rows) {
        if (pdf.y > 700) {
            pdf.addPage();
            title();
        }
        pdf.fontSize(10).text(`${row.bookingCode ?? 'Quyết toán'} · ${row.type} · ${fmt(row.amount)}`).fontSize(9).fillColor('#475569').text(row.description).fillColor('#0f172a').moveDown(0.6);
    }
    if (pdf.y > 620) {
        pdf.addPage();
        title();
    }
    pdf.moveDown(2).fontSize(10).text('Người lập báo cáo                                      Đại diện đơn vị').text('(Ký, ghi rõ họ tên)                                     (Ký, ghi rõ họ tên)');
    pdf.end();
    return result;
}
