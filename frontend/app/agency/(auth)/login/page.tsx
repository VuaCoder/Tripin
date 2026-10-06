import { AgencyLoginPage } from '@/features/agency-auth';

export const metadata = { title: 'Đăng nhập Agency | Tripri Partner' };

interface PageProps {
  searchParams?: { registered?: string; email?: string };
}

export default function AgencyLoginRoute({ searchParams }: PageProps) {
  return <AgencyLoginPage registered={searchParams?.registered === 'true'} initialEmail={searchParams?.email ?? ''} />;
}
