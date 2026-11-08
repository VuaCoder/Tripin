import { describe, expect, it } from 'vitest';
import { redactAudit } from '../audit.writer';
import { csvCell } from '../audit-export.routes';
describe('audit output sanitation', () => {
  it('removes secrets recursively without losing safe before/after values', () => {
    expect(redactAudit({ before: { status: 'BANNED', passwordHash: 'private' }, after: { status: 'ACTIVE', nested: [{ refreshToken: 'private', reason: 'verified' }] }, authorization: 'private' })).toEqual({ before: { status: 'BANNED' }, after: { status: 'ACTIVE', nested: [{ reason: 'verified' }] } });
  });
  it.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =HYPERLINK("x")'])('neutralizes spreadsheet formula %s', (value) => {
    expect(csvCell(value).startsWith('"\'')).toBe(true);
  });
  it('escapes commas, quotes and newlines as a single CSV cell', () => {
    expect(csvCell('Tiếng Việt, "quoted"\nnext')).toBe('"Tiếng Việt, ""quoted""\nnext"');
  });
});
