'use client';
import { useEffect, useState } from 'react';
import { Check, Clock3, Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAgencyContext } from './agencyContext';
import { useCurrentJoinCodeQuery, useRotateJoinCodeMutation, useRevokeJoinCodeMutation, workplaceError, type JoinCode } from './workplacesApi';
import styles from './AgencyJoinPanel.module.css';

function joinCodeLoadError(error: unknown) {
  const status = (error as { status?: number | string } | undefined)?.status;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.';
  if (status === 403) return 'Tài khoản hiện tại không có quyền quản lý mã mời của doanh nghiệp này.';
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') return 'Không kết nối được đến máy chủ. Kiểm tra kết nối rồi thử lại.';
  return workplaceError(error);
}

export function AgencyJoinPanel({ active = true, secret = null, onSecretChange }: { active?: boolean; secret?: JoinCode | null; onSecretChange?: (secret: JoinCode | null) => void; onMembershipChanged?: () => Promise<unknown> }) {
  const agency = useAgencyContext();
  const owner = agency?.memberRole === 'OWNER';
  const codes = useCurrentJoinCodeQuery(agency?.agencyId ?? '', { skip: !owner || !active, pollingInterval: 15000, refetchOnFocus: true });
  const [rotate, rotating] = useRotateJoinCodeMutation();
  const [revoke, revoking] = useRevokeJoinCodeMutation();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [localSecret, setLocalSecret] = useState<JoinCode | null>(null);
  const shownSecret = onSecretChange ? secret : localSecret;
  const changeSecret = (code: JoinCode | null) => { setLocalSecret(code); onSecretChange?.(code); };
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setLocalSecret(null); }, [agency?.agencyId]);
  useEffect(() => { setCopied(false); setConfirmRevoke(null); }, [agency?.agencyId, shownSecret?.id]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  if (!owner) return null;
  // A code returned by the create endpoint is shown even if the follow-up status
  // request fails. Only a successful status response can invalidate that reveal.
  const current = codes.isSuccess
    ? codes.currentData?.id === shownSecret?.id ? shownSecret : codes.currentData
    : shownSecret;
  const remaining = current ? Math.max(0, Math.ceil((new Date(current.expiresAt).getTime() - now) / 1000)) : 0;
  const busy = rotating.isLoading || revoking.isLoading;
  const live = Boolean(current && remaining > 0);
  const visibleCode = live && current?.id === shownSecret?.id ? shownSecret?.code : undefined;
  return <section className={styles.panel} aria-labelledby="join-code-heading">
    <h2 id="join-code-heading" className="sr-only">Mã tham gia doanh nghiệp</h2>
    <p className={styles.description}>Chia sẻ mã để nhân viên gửi yêu cầu tham gia. Bạn sẽ chọn vai trò và duyệt từng yêu cầu.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {codes.isError && <p role="alert" className={styles.error}>Không kiểm tra được trạng thái mã: {joinCodeLoadError(codes.error)} <button className={styles.retry} onClick={() => void codes.refetch()}>Thử lại</button></p>}
    {codes.isLoading && !current && <p role="status" className={styles.description}>Đang kiểm tra mã mời…</p>}
    {live ? <div className={styles.codeWell}>
      <div className={styles.codeMeta}><span className={styles.activeBadge}><span aria-hidden="true" />Đang hiệu lực</span><span className={styles.countdown}><Clock3 size={15} aria-hidden="true" /><span className="sr-only">Còn hiệu lực </span><span role="timer" aria-live="off">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span></span></div>
      {visibleCode ? <>
        <output aria-label="Mã mời" className={styles.codeValue}>{visibleCode.match(/.{1,4}/g)?.map((group, i) => <span key={i}>{group}</span>)}</output>
        <button className={styles.primary} disabled={busy} onClick={async () => { setError(''); try { await navigator.clipboard.writeText(visibleCode); setCopied(true); } catch { setError('Không sao chép được. Hãy chọn mã và sao chép thủ công.'); } }}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copied ? 'Đã sao chép' : 'Sao chép mã'}</button>
        <span role="status" className="sr-only">{copied ? 'Đã sao chép mã.' : ''}</span>
      </> : <div className={styles.hiddenCode}><KeyRound size={26} aria-hidden="true" /><p>Mã chỉ hiển thị khi vừa tạo.<br />Nếu chưa lưu, bạn có thể tạo mã mới bên dưới.</p></div>}
    </div> : codes.isSuccess ? <div className={styles.empty}><KeyRound size={26} aria-hidden="true" /><h3>{current ? 'Mã mời đã hết hạn' : 'Chưa có mã mời đang hoạt động'}</h3><p>Tạo mã có hiệu lực 15 phút để chia sẻ với đội ngũ.</p></div> : null}
    <p className={styles.hint}><ShieldCheck size={17} aria-hidden="true" />Nhập mã chỉ gửi yêu cầu, chưa cấp quyền truy cập doanh nghiệp.</p>
    {confirmRevoke && confirmRevoke === current?.id && live ? <div className={styles.confirm}>
      <p>Thu hồi mã này? Nhân viên sẽ không thể dùng mã để gửi yêu cầu mới. Các yêu cầu đã gửi vẫn được giữ.</p>
      <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => setConfirmRevoke(null)}>Giữ mã</button><button className={styles.danger} disabled={busy} onClick={async () => { setError(''); setNotice(''); try { await revoke(confirmRevoke).unwrap(); changeSecret(null); setConfirmRevoke(null); await codes.refetch(); setNotice('Đã thu hồi mã. Các yêu cầu đã gửi vẫn được giữ.'); } catch (e) { setError(workplaceError(e)); } }}>{revoking.isLoading ? 'Đang thu hồi…' : 'Xác nhận thu hồi'}</button></div>
    </div> : <div className={styles.footer}>
      <div><button className={live ? styles.secondary : styles.primary} disabled={busy || codes.isLoading} onClick={async () => { setError(''); setNotice(''); setCopied(false); try { changeSecret(await rotate().unwrap()); setNow(Date.now()); await codes.refetch(); } catch (e) { setError(workplaceError(e)); } }}><RefreshCw size={16} aria-hidden="true" />{rotating.isLoading ? 'Đang tạo mã…' : current ? 'Tạo mã mới' : 'Tạo mã mời'}</button>{live && <p className={styles.replaceHint}>Mã mới sẽ thay thế mã hiện tại.</p>}</div>
      {live && <button className={styles.revoke} disabled={busy} onClick={() => setConfirmRevoke(current!.id)}>Thu hồi mã</button>}
    </div>}
  </section>;
}
