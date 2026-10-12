import { redirect } from 'next/navigation';

interface LegacyExplorePageProps {
  searchParams: { q?: string | string[] };
}

/** Keeps existing bookmarks and old shared links working after tour discovery moved to /tours. */
export default function LegacyExplorePage({ searchParams }: LegacyExplorePageProps) {
  const rawQuery = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const query = rawQuery?.trim();

  redirect(query ? `/tours?q=${encodeURIComponent(query)}` : '/tours');
}
