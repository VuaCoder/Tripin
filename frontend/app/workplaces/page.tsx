import { WorkplacesPage } from '@/features/agency/WorkplacesPage';

export default function Page({ searchParams }: { searchParams?: { next?: string; join?: string } }) {
  return <WorkplacesPage nextPath={searchParams?.next} openJoin={searchParams?.join === '1'} />;
}
