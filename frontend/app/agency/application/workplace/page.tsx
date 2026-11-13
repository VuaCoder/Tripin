import { WorkplaceApplicationPage } from '@/features/agency/WorkplaceApplicationPage';

export default function Page({ searchParams }: { searchParams?: { step?: string } }) {
  const step = Number(searchParams?.step);
  return <WorkplaceApplicationPage initialStep={Number.isInteger(step) && step >= 1 && step <= 3 ? step : 1} />;
}
