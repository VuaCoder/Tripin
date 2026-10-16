import { AgencyBookingDetailPage } from '@/features/agency/AgencyBookingsPage';

export default function Page({ params }: { params: { id: string } }) {
  return <AgencyBookingDetailPage id={params.id} />;
}
