'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight } from 'lucide-react';
import { useStore } from 'react-redux';
import type { RootState } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAgency } from '@/features/auth/store/authSlice';
import { useAgencyMembershipsQuery } from './agencyContext';
import { WorkplaceFrame } from './WorkplaceFrame';
import { useCreateWorkplaceMutation, useSaveWorkplaceApplicationMutation, workplaceError, type ApplicationDraft, type WorkplaceApplication } from './workplacesApi';
import styles from './Workplace.module.css';

const labels: Record<keyof ApplicationDraft, string> = { companyName: 'Tên doanh nghiệp', address: 'Địa chỉ doanh nghiệp', description: 'Giới thiệu', website: 'Website', licenseNumber: 'Số giấy phép kinh doanh', taxId: 'Mã số thuế', businessLicenseUrl: 'Liên kết giấy phép' };
const basicFields: (keyof ApplicationDraft)[] = ['companyName', 'address', 'description', 'website'];
const documentFields: (keyof ApplicationDraft)[] = ['licenseNumber', 'taxId', 'businessLicenseUrl'];
const emptyDraft: ApplicationDraft = { companyName: '', address: '', description: '', website: '', licenseNumber: '', taxId: '', businessLicenseUrl: '' };
const limits: Record<keyof ApplicationDraft, number> = { companyName: 200, address: 500, description: 5000, website: 300, licenseNumber: 100, taxId: 50, businessLicenseUrl: 1000 };

function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const beforeNavigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const control = event.target instanceof Element ? event.target.closest('a[href], [data-workplace-leave]') : null;
      if (!control || control.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Bạn còn thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeNavigate, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', beforeNavigate, true); };
  }, [dirty]);
}

function Fields({ keys, draft, onChange }: { keys: (keyof ApplicationDraft)[]; draft: ApplicationDraft; onChange: (key: keyof ApplicationDraft, value: string) => void }) {
  return <>{keys.map(key => <label className={styles.field} key={key}>{labels[key]}{key === 'companyName' && ' *'}
    {key === 'description' ? <textarea rows={4} maxLength={limits[key]} value={draft[key] ?? ''} onChange={e => onChange(key, e.target.value)} /> : <input type={key === 'website' || key === 'businessLicenseUrl' ? 'url' : 'text'} required={key === 'companyName'} minLength={key === 'companyName' ? 2 : undefined} maxLength={limits[key]} value={draft[key] ?? ''} onChange={e => onChange(key, e.target.value)} />}
    {key === 'businessLicenseUrl' && <small>Liên kết tài liệu giấy phép của doanh nghiệp, nếu có.</small>}
  </label>)}</>;
}

function Stepper({ step }: { step: number }) {
  return <ol className={styles.steps} aria-label="Tiến trình thiết lập">{['Thông tin doanh nghiệp', 'Hồ sơ xác minh', 'Kiểm tra và gửi'].map((label, i) => <li key={label} className={styles.step + (step === i + 1 ? ' ' + styles.currentStep : '')} aria-current={step === i + 1 ? 'step' : undefined}><span>{step > i + 1 ? <Check size={15} aria-label="Đã hoàn tất" /> : i + 1}</span>{label}</li>)}</ol>;
}

function Summary({ draft }: { draft: ApplicationDraft }) {
  return <dl className={styles.summary}>{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{draft[key as keyof ApplicationDraft] || 'Chưa cung cấp'}</dd></div>)}</dl>;
}

export function CreateWorkplacePage() {
  const userId = useAppSelector(s => s.auth.user?.id);
  return <WorkplaceFrame narrow><CreateForm key={userId} /></WorkplaceFrame>;
}

function CreateForm() {
  const store = useStore<RootState>();
  const [draft, setDraft] = useState<ApplicationDraft>(emptyDraft);
  const userId = useAppSelector(s => s.auth.user?.id);
  const identity = useRef(userId);
  identity.current = userId;
  useEffect(() => { identity.current = userId; return () => { identity.current = undefined; }; }, [userId]);
  const [create, state] = useCreateWorkplaceMutation();
  const memberships = useAgencyMembershipsQuery(undefined, { skip: !userId });
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef('');
  const created = useRef(false);
  useUnsavedChanges(Boolean(draft.companyName || draft.address));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !userId) return;
    const actor = userId;
    const later = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'later';
    setError(''); setBusy(true);
    try {
      const storageKey = 'tripri_workplace_create:' + actor;
      if (!requestKey.current) {
        try { requestKey.current = sessionStorage.getItem(storageKey) ?? ''; } catch { /* Memory still protects retries in this tab. */ }
        if (!/^[0-9a-f-]{36}$/i.test(requestKey.current)) requestKey.current = crypto.randomUUID();
        try { sessionStorage.setItem(storageKey, requestKey.current); } catch { /* Storage is optional. */ }
      }
      const result = await create({ ...draft, companyName: draft.companyName.trim(), requestId: requestKey.current }).unwrap();
      created.current = true;
      if (identity.current !== actor) return;
      // Membership synchronization changes agencyEpoch and clears RTK's cache.
      // Read the synchronized auth state rather than a query result erased by it.
      await memberships.refetch();
      if (identity.current !== actor) return;
      const account = store.getState().auth;
      if (account.user?.id !== actor) return;
      const agencies = account.agencies;
      if (!agencies.some(a => a.agencyId === result.id)) throw new Error('MEMBERSHIP_NOT_READY');
      try { sessionStorage.removeItem(storageKey); } catch { /* Ignore unavailable storage. */ }
      if (later) router.push('/workplaces');
      else { dispatch(selectAgency(result.id)); router.replace('/agency/application/workplace?step=2'); }
    } catch (caught) { setError(created.current ? 'Doanh nghiệp đã được tạo nhưng chưa đồng bộ được quyền truy cập. Nhấn Tiếp tục để thử lại; doanh nghiệp sẽ không được tạo lần nữa.' : workplaceError(caught)); }
    finally { setBusy(false); }
  }
  return <>
    <Link className={styles.textButton} href="/workplaces">← Chọn nơi làm việc</Link>
    <div className={styles.eyebrow}>Thiết lập nơi làm việc</div><h1 className={styles.title}>Tạo doanh nghiệp mới</h1><p className={styles.description}>Bạn sẽ là chủ doanh nghiệp và có thể mời đội ngũ sau khi tạo.</p>
    <Stepper step={1} />
    <form className={styles.panel} onSubmit={submit}><h2 className={styles.sectionTitle}>Thông tin doanh nghiệp</h2><p className={styles.description}>Bắt đầu với tên doanh nghiệp. Bạn có thể lưu lại và hoàn thiện hồ sơ sau.</p>
      <fieldset disabled={busy || state.isLoading} style={{ marginTop: 24 }}><Fields keys={basicFields} draft={draft} onChange={(key, value) => setDraft({ ...draft, [key]: value })} /></fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.footer}><button className={styles.textButton} value="later" disabled={busy}>Lưu và hoàn tất sau</button><button className={styles.primary} value="next" disabled={busy}>{busy ? 'Đang tạo doanh nghiệp…' : 'Tiếp tục'}<ArrowRight size={16} aria-hidden="true" /></button></div>
    </form>
  </>;
}

export function WorkplaceWizard({ profile, initialStep = 1, onSaved }: { profile: WorkplaceApplication; initialStep?: number; onSaved: () => void }) {
  const initial = { ...emptyDraft, ...Object.fromEntries(Object.keys(emptyDraft).map(key => [key, profile[key as keyof WorkplaceApplication] ?? ''])) } as ApplicationDraft;
  const [draft, setDraft] = useState<ApplicationDraft>(initial);
  const [saved, setSaved] = useState<ApplicationDraft>(initial);
  const [current, setCurrent] = useState(profile);
  const [step, setStep] = useState(Math.min(3, Math.max(1, initialStep)));
  const [save, state] = useSaveWorkplaceApplicationMutation();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedChanges(dirty && !submitted);
  const pending = current.verificationStatus === 'PENDING' || profile.verificationStatus === 'PENDING';
  const complete = Boolean(draft.companyName.trim().length >= 2 && draft.address?.trim() && draft.licenseNumber?.trim());
  async function persist(target: number | 'exit' | 'submit') {
    if (state.isLoading || pending) return;
    setError(''); setNotice('');
    if ((target === 3 || target === 'submit') && !complete) { setError('Bổ sung tên, địa chỉ và số giấy phép kinh doanh trước khi gửi xác minh.'); return; }
    try {
      const sendForReview = target === 'submit' && current.verificationStatus !== 'VERIFIED';
      const result = await save({ draft: { ...draft, companyName: draft.companyName.trim() }, submit: sendForReview }).unwrap();
      setCurrent(result); setSaved({ ...draft }); onSaved();
      if (target === 'exit') router.push('/workplaces');
      else if (target === 'submit') { if (result.verificationStatus === 'PENDING') setSubmitted(true); else router.push('/workplaces'); }
      else { setStep(target); setNotice('Đã lưu thông tin.'); router.replace('/agency/application/workplace?step=' + target); }
    } catch (caught) { setError(workplaceError(caught)); }
  }
  if (submitted || pending) return <section className={styles.panel}><div className={styles.successIcon}><Check size={26} aria-hidden="true" /></div><h1 className={styles.title}>{submitted ? 'Đã gửi hồ sơ xác minh' : 'Hồ sơ đang chờ xác minh'}</h1><p className={styles.description} role="status">Hồ sơ của {current.companyName} đang được xem xét. Các chức năng vận hành sẽ được mở khi doanh nghiệp được xác minh.</p><Summary draft={saved} /><div className={styles.footer}><Link className={styles.primary} href="/workplaces">Về nơi làm việc</Link></div></section>;
  return <>
    <Link className={styles.textButton} href="/workplaces">← Nơi làm việc</Link>
    <div className={styles.eyebrow}>{current.verificationStatus === 'VERIFIED' ? 'Hồ sơ doanh nghiệp' : 'Tiếp tục thiết lập'}</div><h1 className={styles.title}>{current.companyName}</h1>
    <p className={styles.description}>{current.verificationStatus === 'VERIFIED' ? 'Thay đổi thông tin pháp lý có thể yêu cầu xác minh lại doanh nghiệp.' : 'Hoàn thiện thông tin doanh nghiệp để gửi hồ sơ xác minh.'}</p>
    {current.verificationNote && <p className={styles.notice}>Ghi chú xét duyệt: {current.verificationNote}</p>}
    <Stepper step={step} />
    <form className={styles.panel} onSubmit={e => { e.preventDefault(); void persist(step === 3 ? 'submit' : step + 1); }}>
      <h2 className={styles.sectionTitle}>{step === 1 ? 'Thông tin doanh nghiệp' : step === 2 ? 'Hồ sơ xác minh' : 'Kiểm tra trước khi gửi'}</h2>
      {step === 2 && <p className={styles.description}>Cung cấp số giấy phép kinh doanh. Mã số thuế và liên kết tài liệu có thể bổ sung nếu có.</p>}
      {step === 3 ? <><p className={styles.description}>Kiểm tra thông tin bên dưới. Gửi hồ sơ chưa đồng nghĩa với việc doanh nghiệp đã được xác minh.</p><Summary draft={draft} /><button type="button" className={styles.textButton} onClick={() => setStep(1)}>Chỉnh sửa thông tin</button></> : <fieldset disabled={state.isLoading} style={{ marginTop: 24 }}><Fields keys={step === 1 ? basicFields : documentFields} draft={draft} onChange={(key, value) => setDraft({ ...draft, [key]: value })} /></fieldset>}
      {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.footer}><div className={styles.actions}>{step > 1 && <button type="button" className={styles.button} disabled={state.isLoading} onClick={() => { setStep(step - 1); setError(''); setNotice(''); }}>Quay lại</button>}<button type="button" className={styles.textButton} disabled={state.isLoading} onClick={() => void persist('exit')}>Lưu và hoàn tất sau</button></div>
        <button className={styles.primary} disabled={state.isLoading}>{state.isLoading ? 'Đang lưu…' : step === 3 ? current.verificationStatus === 'VERIFIED' ? 'Lưu thay đổi' : 'Gửi hồ sơ xác minh' : 'Tiếp tục'}<ArrowRight size={16} aria-hidden="true" /></button></div>
    </form>
  </>;
}
