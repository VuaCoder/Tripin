'use client';

import { useAppSelector } from '@/store/hooks';
import { selectActiveAgency } from '@/features/auth/store/authSlice';
import { useAgencyMembershipsQuery } from './agencyContext';
import { useWorkplaceApplicationQuery } from './workplacesApi';
import { WorkplaceFrame } from './WorkplaceFrame';
import { WorkplaceWizard } from './WorkplaceWizard';
import styles from './Workplace.module.css';
import Link from 'next/link';

export function WorkplaceApplicationPage({ initialStep = 1 }: { initialStep?: number }) {
  const status = useAppSelector(s => s.auth.status);
  const memberships = useAgencyMembershipsQuery(undefined, { skip: status !== 'authenticated' });
  const agency = useAppSelector(selectActiveAgency);
  const query = useWorkplaceApplicationQuery(agency?.agencyId ?? '', { skip: !agency || agency.memberRole !== 'OWNER' });
  return <WorkplaceFrame narrow>
    {!agency ? <><h1 className={styles.title}>Chọn doanh nghiệp cần cập nhật</h1><Link className={styles.textButton} href="/workplaces">Về nơi làm việc →</Link></>
      : agency.memberRole !== 'OWNER' ? <p role="alert" className={styles.error}>Chỉ chủ doanh nghiệp được cập nhật hồ sơ.</p>
      : query.isLoading ? <p role="status">Đang tải hồ sơ doanh nghiệp…</p>
      : query.isError && !query.currentData ? <p role="alert" className={styles.error}>Không tải được hồ sơ. <button className={styles.textButton} onClick={() => void query.refetch()}>Thử lại</button></p>
      : query.currentData && <WorkplaceWizard key={agency.agencyId} profile={query.currentData} initialStep={initialStep} onSaved={() => { void memberships.refetch(); }} />}
  </WorkplaceFrame>;
}
