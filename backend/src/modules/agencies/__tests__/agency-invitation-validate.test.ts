import { describe, beforeEach, expect, it, vi } from 'vitest';
import { agencyService } from '../agency.service';

/**
 * The token-validate endpoint is public and returns only safe metadata. These tests pin the
 * PENDING/EXPIRED/ACCEPTED/REVOKED mapping, the AppError.notFound for unknown tokens, and the
 * email redaction (full only when the caller passes the matching email.
 */
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('../../../config/database', () => ({
  prisma: {
    agencyInvitation: { findUnique },
  },
}));

const TOKEN = 'a'.repeat(64);
const PENDING_EMAIL = 'johndoe@example.com';

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    email: PENDING_EMAIL,
    role: 'STAFF',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000),
    agency: { companyName: 'Travel Co.' },
    ...overrides,
  };
}

describe('AgencyService.validateInvitationToken', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns NOT_FOUND (404 AppError) for an unknown token', async () => {
    findUnique.mockResolvedValue(null);
    await expect(agencyService.validateInvitationToken(TOKEN)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('reports a fresh PENDING invitation and masks the email unless it matches the hint', async () => {
    findUnique.mockResolvedValue(invitation());

    const noHint = await agencyService.validateInvitationToken(TOKEN);
    expect(noHint.status).toBe('PENDING');
    expect(noHint.role).toBe('STAFF');
    expect(noHint.agencyName).toBe('Travel Co.');
    expect(noHint.emailMatched).toBe(false);
    // Masked: not equal to the full address, still shows the domain.
    expect(noHint.email).not.toBe(PENDING_EMAIL);
    expect(noHint.email).toContain('@example.com');

    const matched = await agencyService.validateInvitationToken(TOKEN, 'JOHNDOE@Example.COM');
    expect(matched.emailMatched).toBe(true);
    expect(matched.email).toBe(PENDING_EMAIL);

    const wrong = await agencyService.validateInvitationToken(TOKEN, 'other@example.com');
    expect(wrong.emailMatched).toBe(false);
  });

  it('maps ACCEPTED / REVOKED to their own statuses', async () => {
    findUnique.mockResolvedValue(invitation({ status: 'ACCEPTED' }));
    expect((await agencyService.validateInvitationToken(TOKEN)).status).toBe('ACCEPTED');

    findUnique.mockResolvedValue(invitation({ status: 'REVOKED' }));
    expect((await agencyService.validateInvitationToken(TOKEN)).status).toBe('REVOKED');
  });

  it('reports EXPIRED for a DB EXPIRED row and for a PENDING row past its deadline', async () => {
    findUnique.mockResolvedValue(invitation({ status: 'EXPIRED' }));
    expect((await agencyService.validateInvitationToken(TOKEN)).status).toBe('EXPIRED');

    findUnique.mockResolvedValue(invitation({ expiresAt: new Date(Date.now() - 60000) }));
    expect((await agencyService.validateInvitationToken(TOKEN)).status).toBe('EXPIRED');
  });
});
