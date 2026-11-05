import { describe, expect, it } from 'vitest';
import { toReportCode } from '../reports.mapper';

describe('toReportCode', () => {
  it('derives a short upper-case lookup code from the id', () => {
    expect(toReportCode('1a2b3c4d-0000-4000-8000-000000000000')).toBe('RP-1A2B3C4D');
  });
});
