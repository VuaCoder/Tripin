import { AgencyNotificationInbox } from '@/features/agency/components/AgencyNotificationInbox';
import { AgencyPageTitle } from '@/features/agency/components/AgencyPageTitle';
import { Bell } from 'lucide-react';
export default function AgencyNotificationsPage() {
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><header className="mb-7"><AgencyPageTitle icon={Bell}>Thông báo</AgencyPageTitle></header><AgencyNotificationInbox /></main>;
}
