import { AppError } from '../../utils/app-error';
export const positiveMoney = (value: string): bigint => {
    if (!/^[1-9]\d{0,15}$/.test(value))
        throw AppError.badRequest('Số tiền phải là số nguyên VND lớn hơn 0.');
    return BigInt(value);
};
export function refundSplit(total: bigint, commission: bigint, previous: bigint, amount: bigint) {
    if (total <= 0n || commission < 0n || commission > total || previous < 0n || amount <= 0n || previous + amount > total)
        throw AppError.badRequest('Số tiền hoàn vượt số tiền còn có thể hoàn.');
    // Cumulative allocation makes split refunds sum exactly to the original commission.
    const fee = ((previous + amount) * commission / total) - (previous * commission / total);
    return { commission: fee, agency: amount - fee };
}
export function periodRange(period = 'month', from?: string, to?: string, now = new Date()) {
    const vn = new Date(now.getTime() + 7 * 3600000);
    let start: Date, end: Date;
    if (period === 'custom') {
        if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
            throw AppError.badRequest('Chọn khoảng ngày hợp lệ.');
        start = new Date(`${from}T00:00:00+07:00`);
        end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
            throw AppError.badRequest('Ngày không hợp lệ.');
        if (new Date(start.getTime() + 25200000).toISOString().slice(0, 10) !== from || new Date(end.getTime() - 86400000 + 25200000).toISOString().slice(0, 10) !== to)
            throw AppError.badRequest('Ngày không hợp lệ.');
    }
    else {
        const y = vn.getUTCFullYear(), m = vn.getUTCMonth(), d = vn.getUTCDate();
        const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day) - 25200000);
        if (period === 'week') {
            start = utc(y, m, d - (vn.getUTCDay() + 6) % 7);
            end = new Date(start.getTime() + 7 * 86400000);
        }
        else if (period === 'quarter') {
            start = utc(y, Math.floor(m / 3) * 3, 1);
            end = utc(y, Math.floor(m / 3) * 3 + 3, 1);
        }
        else {
            start = utc(y, m, 1);
            end = utc(y, m + 1, 1);
        }
    }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86400000)
        throw AppError.badRequest('Khoảng thời gian tối đa 366 ngày.');
    return { start, end };
}
export const jsonMoney = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
export type Posting = {
    account: string;
    debit: bigint;
    credit: bigint;
};
export function assertBalanced(entries: Posting[]) {
    if (entries.length < 2 || entries.some(e => e.debit < 0n || e.credit < 0n || (e.debit > 0n && e.credit > 0n)) ||
        entries.reduce((s, e) => s + e.debit - e.credit, 0n) !== 0n)
        throw AppError.conflict('Chứng từ tài chính không cân bằng.');
}
