import type { AgencyMembership, SessionData } from '@/features/auth/types';

export const membershipFixture = (overrides: Partial<AgencyMembership> = {}): AgencyMembership => ({
  agencyId: '11111111-1111-4111-8111-111111111111', memberId: 'member-1', memberRole: 'OWNER',
  companyName: 'Test Agency', verificationStatus: 'VERIFIED', permissions: ['agency:context-view'], ...overrides,
});

/** Old tests still exercise the same endpoints, now with a real session contract. */
export const withAgencyMembership = (session: SessionData): SessionData => ({
  ...session, agencies: [membershipFixture({ permissions: session.user.permissions ?? [] })],
});
