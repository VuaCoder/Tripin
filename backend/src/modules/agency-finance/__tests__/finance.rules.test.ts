import { describe, it, expect } from 'vitest';
import { refundSplit, periodRange, assertBalanced, positiveMoney } from '../finance.rules';
import { excelAmount } from '../finance.export';
describe('Finance money and calendar rules', () => {
    it('allocates repeated partial refunds without losing rounding remainder', () => {
        let fee = 0n;
        for (let i = 0n; i < 7n; i++)
            fee += refundSplit(7n, 2n, i, 1n).commission;
        expect(fee).toBe(2n);
        expect(refundSplit(10000000n, 1000000n, 0n, 2000000n)).toEqual({ commission: 200000n, agency: 1800000n });
        expect(() => refundSplit(7n, 2n, 6n, 2n)).toThrow();
    });
    it('keeps VND above PostgreSQL Int range exact', () => {
        expect(positiveMoney('50000000000')).toBe(50000000000n);
        expect(() => positiveMoney('1.5')).toThrow();
        expect(() => positiveMoney('-10')).toThrow();
        expect(excelAmount(999999999999999n)).toBe(999999999999999);
        expect(excelAmount(1000000000000001n)).toBe('1000000000000001');
    });
    it('uses Monday and inclusive calendar end in Vietnam, including UTC date boundaries', () => {
        const week = periodRange('week', undefined, undefined, new Date('2026-11-15T18:00:00Z'));
        expect(week.start.toISOString()).toBe('2026-11-15T17:00:00.000Z');
        expect(week.end.toISOString()).toBe('2026-11-22T17:00:00.000Z');
        expect(periodRange('custom', '2026-11-17', '2026-11-17').end.toISOString()).toBe('2026-11-17T17:00:00.000Z');
        expect(() => periodRange('custom', '2026-02-30', '2026-03-01')).toThrow();
        expect(() => periodRange('custom', '2026-99-01', '2026-99-02')).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
    it('rejects non-balancing or mixed debit/credit entries', () => {
        expect(() => assertBalanced([{ account: 'cash', debit: 10n, credit: 0n }, { account: 'payable', debit: 0n, credit: 9n }])).toThrow();
        expect(() => assertBalanced([{ account: 'cash', debit: 10n, credit: 1n }, { account: 'payable', debit: 0n, credit: 9n }])).toThrow();
    });
});
