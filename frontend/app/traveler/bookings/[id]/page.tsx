import { redirect } from 'next/navigation';

/** Legacy booking-detail URLs remain valid, but the canonical traveler flow lives in Settings. */
export default function TravelerBookingDetailPage({ params }: { params: { id: string } }) {
  redirect(`/settings/history/${params.id}`);
}
