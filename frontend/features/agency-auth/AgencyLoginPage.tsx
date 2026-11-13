'use client';

import { PartnerAccountPage } from './PartnerAccountPage';

/** Compatible export for the account-based Partner entry. */
export function AgencyLoginPage(props: { registered?: boolean; initialEmail?: string }) {
  return <PartnerAccountPage {...props} />;
}
