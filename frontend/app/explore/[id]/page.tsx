import { redirect } from 'next/navigation';

interface LegacyExploreDetailPageProps {
  params: { id: string };
}

/** Keeps old detail URLs valid while the public route is /tours/:id. */
export default function LegacyExploreDetailPage({ params }: LegacyExploreDetailPageProps) {
  redirect(`/tours/${encodeURIComponent(params.id)}`);
}
