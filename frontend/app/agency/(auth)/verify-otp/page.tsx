import { AgencyOtpPage, type AgencyOtpPurpose } from '@/features/agency-auth';

export const metadata = { title: 'Xác thực Agency | Tripri Partner' };

interface PageProps {
  searchParams?: { email?: string; purpose?: string; expires?: string };
}

export default function AgencyVerifyOtpRoute({ searchParams }: PageProps) {
  const purpose: AgencyOtpPurpose = searchParams?.purpose === 'LOGIN_2FA' ? 'LOGIN_2FA' : 'REGISTER';
  const parsedExpiry = Number(searchParams?.expires);
  const expiresInSeconds = Number.isFinite(parsedExpiry) && parsedExpiry > 0 ? Math.min(parsedExpiry, 3600) : undefined;

  return <AgencyOtpPage email={searchParams?.email ?? ''} purpose={purpose} expiresInSeconds={expiresInSeconds} />;
}
