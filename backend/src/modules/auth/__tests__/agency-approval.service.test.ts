import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AgencyApprovalService } from '../agency-approval.service';

describe('Agency status tokens', () => {
  const service = new AgencyApprovalService();

  it('round-trips the normalized email', () => {
    const token = service.generateStatusToken(' Agency@Example.com ');
    expect(service.verifyStatusToken(token)).toBe('agency@example.com');
  });

  it.each(['', '.', 'payload.', '.signature', 'a.b.c', 'payload.invalid'])('rejects malformed or invalid token %j', (token) => {
    expect(() => service.verifyStatusToken(token)).toThrow();
  });

  it('rejects tampering and signatures made with the old hardcoded fallback', () => {
    const token = service.generateStatusToken('agency@example.com');
    const payload = Buffer.from('other@example.com').toString('base64url');
    expect(() => service.verifyStatusToken(`${payload}.${token.split('.')[1]}`)).toThrow();
    const signature = createHmac('sha256', 'tripri-agency-approval-secret').update(payload).digest('base64url');
    expect(() => service.verifyStatusToken(`${payload}.${signature}`)).toThrow();
  });
});
