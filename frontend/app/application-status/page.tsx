'use client';

import { Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, PencilLine } from 'lucide-react';
import { agencyAuthApi, type AgencyApplicationStatusDto } from '@/features/agency-auth';
import styles from './page.module.css';

function WaitingClock() {
  const [angles, setAngles] = useState({ seconds: 0, minutes: 0, hours: 0 });

  useEffect(() => {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    setAngles({ seconds: seconds * 6, minutes: minutes * 6, hours: (now.getHours() % 12 + minutes / 60) * 30 });
  }, []);

  const handStyle = (angle: number): CSSProperties => ({ '--hand-angle': `${angle}deg` } as CSSProperties);

  return (
    <div className={styles.clockScene} aria-hidden="true">
      <div className={styles.clockShadow} />
      <div className={styles.clockFloat}>
        <div className={styles.clockCase}>
          <div className={styles.clockFace}>
            <div className={styles.clockTicks} />
            <span className={`${styles.numeral} ${styles.twelve}`}>12</span>
            <span className={`${styles.numeral} ${styles.three}`}>3</span>
            <span className={`${styles.numeral} ${styles.six}`}>6</span>
            <span className={`${styles.numeral} ${styles.nine}`}>9</span>
            <span className={styles.clockSignature}>tripri</span>
            <span className={`${styles.hand} ${styles.hourHand}`} style={handStyle(angles.hours)} />
            <span className={`${styles.hand} ${styles.minuteHand}`} style={handStyle(angles.minutes)} />
            <span className={`${styles.hand} ${styles.secondHand}`} style={handStyle(angles.seconds)} />
            <span className={styles.clockPin} />
            <div className={styles.clockReflection} />
          </div>
        </div>
      </div>
    </div>
  );
}

function IncompleteDocument() {
  return (
    <div className={styles.clockScene} aria-hidden="true">
      <div className={styles.clockShadow} />
      <div className={styles.documentFloat}>
        <div className={styles.documentBack} />
        <div className={styles.documentPaper}>
          <div className={styles.documentSheet}>
            <span className={styles.documentFold} />
            <span className={styles.documentHeading} />
            <span className={styles.documentSubheading} />
            <div className={styles.documentChecklist}>
              <div className={styles.documentRow}><Check /><span /></div>
              <div className={styles.documentRow}><Check /><span /></div>
              <div className={`${styles.documentRow} ${styles.documentMissing}`}><span className={styles.emptyCheckbox} /><span /></div>
            </div>
          </div>
        </div>
        <div className={styles.documentPencil}><span /><i /></div>
        <div className={styles.documentEditBadge}><PencilLine strokeWidth={1.8} /></div>
      </div>
    </div>
  );
}

function ApprovedBadge() {
  return (
    <div className={styles.clockScene} aria-hidden="true">
      <div className={styles.clockShadow} />
      <div className={styles.approvedFloat}>
        <div className={styles.approvedMedallion}>
          <div className={styles.approvedFace}><Check strokeWidth={3.5} /></div>
        </div>
      </div>
    </div>
  );
}

function StatusScene({ children, visual = 'waiting' }: { children: ReactNode; visual?: 'waiting' | 'incomplete' | 'approved' }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setPaused(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return (
    <main className={styles.page} data-paused={paused}>
      <div className={styles.background} aria-hidden="true">
        <div className={styles.sunlight} />
        <svg className={styles.waves} viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none">
          <path className={styles.waveBack} d="M-200 570C130 310 330 880 760 610S1250 400 1640 560V1100H-200Z" fill="#bce4d9" />
          <path className={styles.waveMiddle} d="M-200 730C150 500 430 1010 860 700S1380 590 1640 690V1100H-200Z" fill="#83c8ba" />
          <path className={styles.waveFront} d="M-200 840C210 630 420 1060 900 860S1390 670 1640 830V1100H-200Z" fill="#389f99" />
          <path className={styles.waveLine} d="M-200 650C170 390 410 970 830 680S1330 480 1640 650" stroke="#087e8b" strokeOpacity=".2" strokeWidth="1.5" />
        </svg>
        <span className={`${styles.spark} ${styles.sparkOne}`} />
        <span className={`${styles.spark} ${styles.sparkTwo}`} />
        <span className={`${styles.spark} ${styles.sparkThree}`} />
      </div>
      <header className={styles.header}>
        <span className={styles.logo}>
          <Image src="/images/tripri-logo.png" alt="Tripri" width={116} height={48} priority draggable={false} className={styles.logoImage} />
        </span>
      </header>
      <section className={styles.content} aria-live="polite" aria-atomic="true">
        {visual === 'approved' ? <ApprovedBadge /> : visual === 'incomplete' ? <IncompleteDocument /> : <WaitingClock />}
        <div className={styles.message}>{children}</div>
      </section>
    </main>
  );
}

function ApplicationStatusContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || undefined;
  const email = searchParams.get('email') || undefined;
  const [statusData, setStatusData] = useState<AgencyApplicationStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [testAction, setTestAction] = useState<'accept' | 'reject' | null>(null);
  const [testError, setTestError] = useState('');
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('Ảnh giấy phép kinh doanh chưa rõ nét, vui lòng bổ sung ảnh rõ hơn.');
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    let active = true;
    setStatusData(null);
    setError(null);
    setTestError('');
    setShowRejectReason(false);
    if (!token && !email) {
      setError('Vui lòng mở liên kết trong email để xem trạng thái hồ sơ.');
      setLoading(false);
      return;
    }
    setLoading(true);
    agencyAuthApi.getApplicationStatus({ token, email })
      .then((data) => { if (active) setStatusData(data); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Không thể tải trạng thái hồ sơ. Vui lòng thử lại.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, email, attempt]);

  const runTestAction = async (action: 'accept' | 'reject') => {
    if (!isDev || !statusData || testAction || statusData.verificationStatus !== 'PENDING') return;
    setTestError('');
    if (action === 'reject' && (rejectReason.trim().length < 2 || rejectReason.trim().length > 500)) {
      setTestError('Lý do từ chối cần từ 2 đến 500 ký tự.');
      return;
    }
    setTestAction(action);
    try {
      const identity = { token: statusData.token, email: statusData.email };
      const response = action === 'accept'
        ? await agencyAuthApi.devAccept(identity)
        : await agencyAuthApi.devReject({ ...identity, reason: rejectReason.trim() });
      setStatusData(response.status);
      setShowRejectReason(false);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Không thể thực hiện thao tác. Vui lòng thử lại.');
    } finally {
      setTestAction(null);
    }
  };

  let message: ReactNode;
  if (loading) {
    message = <p className={styles.description} role="status">Đang kiểm tra trạng thái hồ sơ…</p>;
  } else if (error) {
    message = <>
      <h1 className={styles.title}>Chưa thể tải hồ sơ</h1>
      <p className={styles.description} role="alert">{error}</p>
      {token || email
        ? <button type="button" className={styles.action} onClick={() => setAttempt((value) => value + 1)}>Thử lại</button>
        : <Link href="/agency/login" className={styles.action}>Đăng nhập Agency</Link>}
    </>;
  } else if (statusData?.verificationStatus === 'VERIFIED') {
    message = <>
      <h1 className={styles.title}>Hồ sơ của bạn đã được phê duyệt!</h1>
      <Link href="/agency/login" className={styles.action}>Đăng nhập Agency</Link>
    </>;
  } else if (statusData?.verificationStatus === 'REJECTED') {
    const query = new URLSearchParams(statusData.token ? { token: statusData.token } : { email: statusData.email });
    message = <>
      <h1 className={styles.title}>Hồ sơ cần được bổ sung</h1>
      <p className={styles.description}>{statusData.verificationNote || 'Vui lòng kiểm tra và cập nhật lại thông tin hồ sơ.'}</p>
      <Link href={`/agency/application/edit?${query}`} className={styles.action}>Chỉnh sửa hồ sơ</Link>
    </>;
  } else if (statusData?.verificationStatus === 'PENDING') {
    message = <>
      <h1 className={styles.title}>Hồ sơ của bạn đã được gửi thành công!</h1>
      <p className={styles.description}>Xin vui lòng đợi kết quả!</p>
      {isDev && <div className={styles.testControls} aria-label="Kiểm thử xét duyệt hồ sơ" aria-busy={!!testAction}>
        <p className={styles.testLabel}>Kiểm thử · Chỉ trong môi trường phát triển</p>
        <div className={styles.testButtons}>
          <button type="button" className={`${styles.action} ${styles.testButton}`} disabled={!!testAction} onClick={() => void runTestAction('accept')}>
            {testAction === 'accept' ? 'Đang xét duyệt…' : 'Duyệt hồ sơ'}
          </button>
          <button type="button" className={`${styles.action} ${styles.testButton} ${styles.rejectButton}`} disabled={!!testAction} aria-expanded={showRejectReason} aria-controls="reject-reason-form" onClick={() => { setTestError(''); setShowRejectReason((value) => !value); }}>
            Từ chối
          </button>
        </div>
        {showRejectReason && <form id="reject-reason-form" className={styles.rejectForm} onSubmit={(event) => { event.preventDefault(); void runTestAction('reject'); }}>
          <label htmlFor="reject-reason">Lý do từ chối</label>
          <textarea id="reject-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={2} minLength={2} maxLength={500} required disabled={!!testAction} aria-describedby={testError ? 'review-test-error' : undefined} />
          <button type="submit" className={`${styles.action} ${styles.testButton} ${styles.rejectButton}`} disabled={!!testAction || rejectReason.trim().length < 2}>
            {testAction === 'reject' ? 'Đang từ chối…' : 'Xác nhận từ chối'}
          </button>
        </form>}
        {testError && <p id="review-test-error" role="alert" className={styles.testError}>{testError}</p>}
      </div>}
    </>;
  } else {
    message = <>
      <h1 className={styles.title}>Hồ sơ chưa được gửi xét duyệt</h1>
      <Link href="/agency/login" className={styles.action}>Đăng nhập Agency</Link>
    </>;
  }

  const visual = !loading && !error && statusData?.verificationStatus === 'VERIFIED'
    ? 'approved'
    : !loading && !error && statusData?.verificationStatus === 'REJECTED' ? 'incomplete' : 'waiting';
  return <StatusScene visual={visual}>{message}</StatusScene>;
}

export default function ApplicationStatusPage() {
  return (
    <Suspense fallback={<StatusScene><p className={styles.description}>Đang tải trạng thái hồ sơ…</p></StatusScene>}>
      <ApplicationStatusContent />
    </Suspense>
  );
}
