'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Hourglass,
  Loader2,
  Mail,
  ShieldX,
} from 'lucide-react';
import {
  useAcceptAgencyInvitationMutation,
  useValidateAgencyInvitationQuery,
} from './api/agencyInvitationApi';
import { roleLabel } from './roleLabels';
import { useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated } from '@/features/auth/store/authSlice';

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-tealDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50';
const btnGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * Accept-an-agency-invitation page. Rendered at /invitations/accept (outside the
 * /agency shell) because invitees are not yet ACTIVE members and would be blocked
 * by the agency layout gate.
 */
export function AcceptInvitationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  // Local success flag keeps the confirmation screen stable between renders and
  // independent of any query change after accepting.
  const [acceptedAgency, setAcceptedAgency] = useState<string | null>(null);

  const token = searchParams.get('token') ?? '';
  const hasToken = token.length > 0;

  // Validate only when a token is present. The GET endpoint is public, so we can
  // render the invitation (agency, role, email) before the visitor logs in.
  const { data: info, isLoading, isError, refetch } = useValidateAgencyInvitationQuery(token, {
    skip: !hasToken,
    refetchOnMountOrArgChange: true,
  });
  const [accept, { isLoading: isAccepting, error: acceptError }] =
    useAcceptAgencyInvitationMutation();

  const loginTarget = `/login?next=${encodeURIComponent(pathname.replace(/\/$/, '') + (searchParams.toString() ? `?${searchParams.toString()}` : ''))}`;

  if (!hasToken) {
    return (
      <Shell>
        <Card role="alert" tone="amber">
          <CircleAlert className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <Title>Liên kết không hợp lệ</Title>
          <Body>Không tìm thấy mã mời trong liên kết. Vui lòng mở lại email mời để lấy liên kết chính xác.</Body>
          <Link href="/" className="mt-6 block text-center text-sm font-semibold text-brand-teal hover:underline">
            Về trang chủ
          </Link>
        </Card>
      </Shell>
    );
  }

  if (acceptedAgency !== null) {
    return (
      <Shell>
        <Card role="status">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
          <Title>Bạn đã gia nhập {acceptedAgency} thành công</Title>
          <Body>Quản trị viên của doanh nghiệp sẽ thấy bạn trong danh sách thành viên.</Body>
          <button type="button" onClick={() => router.push('/agency')} className={`${btnPrimary} mt-6 w-full`}>
            <ChevronRight className="h-4 w-4" />
            Vào quản trị
          </button>
        </Card>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <Card role="status">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-teal" />
          <Body>Đang kiểm tra lời mời…</Body>
        </Card>
      </Shell>
    );
  }

  if (isError || info?.status === 'INVALID' || info?.status === 'REVOKED' || !info?.status) {
    return (
      <Shell>
        <Card role="alert" tone="red">
          <ShieldX className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <Title>Lời mời không hợp lệ</Title>
          <Body>Mã mời không tồn tại hoặc đã bị thu hồi. Xin vui lòng liên hệ người mời để được cấp lời mời mới.</Body>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => void refetch()} className={btnGhost}>
              Thử lại
            </button>
            <Link href="/" className={btnGhost}>
              Về trang chủ
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  if (info.status === 'EXPIRED') {
    return (
      <Shell>
        <Card role="alert" tone="amber">
          <Hourglass className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <Title>Lời mời đã hết hạn</Title>
          <Body>
            Lời mời vào {info.agencyName ?? 'doanh nghiệp'} đã hết hiệu lực. Vui lòng yêu cầu người mời gửi lại lời mời mới.
          </Body>
          <Link href="/" className="mt-6 block text-center text-sm font-semibold text-brand-teal hover:underline">
            Về trang chủ
          </Link>
        </Card>
      </Shell>
    );
  }

  if (info.status === 'ACCEPTED') {
    return (
      <Shell>
        <Card role="status">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <Title>
            {info.email ? `Lời mời dành cho ${info.email} đã được chấp nhận` : 'Lời mời đã được chấp nhận'}
          </Title>
          <Body>Bạn đã là thành viên của {info.agencyName ?? 'doanh nghiệp'}. Hãy đăng nhập để vào quản trị.</Body>
          <div className="mt-6 flex justify-center">
            <Link href={isAuthenticated ? '/agency' : loginTarget} className={btnPrimary}>
              <ChevronRight className="h-4 w-4" />
              {isAuthenticated ? 'Vào quản trị' : 'Đăng nhập để vào quản trị'}
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  // PENDING — valid invitation with the full info card.
  return (
    <Shell>
      <Card>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lời mời tham gia doanh nghiệp</p>
            <h1 className="text-xl font-bold text-slate-900">{info.agencyName ?? 'Đại lý'}</h1>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {info.agencyName && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Doanh nghiệp" value={info.agencyName} />}
          {info.role && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Vai trò dự kiến" value={roleLabel(info.role)} />}
          {info.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email nhận lời mời" value={info.email} />}
          {info.expiresAt && (
            <InfoRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Hết hạn lúc"
              value={new Date(info.expiresAt).toLocaleString('vi-VN')}
            />
          )}
        </dl>

        {acceptError && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Không thể chấp nhận lời mời. Lời mời có thể đã hết hạn hoặc đã được sử dụng — hãy thử lại hoặc liên hệ người mời.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isAuthenticated ? (
            <>
              <p className="text-sm text-slate-600">Bạn cần đăng nhập để trở thành thành viên doanh nghiệp.</p>
              <Link href={loginTarget} className={btnPrimary}>
                <ChevronRight className="h-4 w-4" />
                Đăng nhập để chấp nhận
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await accept(token).unwrap();
                  setAcceptedAgency(info.agencyName ?? 'doanh nghiệp');
                } catch {
                  // Error surfaced above; keep the card so the user can retry.
                }
              }}
              disabled={isAccepting}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isAccepting ? 'Đang xử lý…' : 'Chấp nhận lời mời'}
            </button>
          )}
        </div>
      </Card>
    </Shell>
  );
}

const cardTone = { amber: 'border-amber-200', red: 'border-red-200' } as const;

function Card({
  children,
  role,
  tone,
}: {
  children: React.ReactNode;
  role?: 'status' | 'alert';
  tone?: 'amber' | 'red';
}) {
  return (
    <div
      role={role}
      className={`w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8 ${tone ? cardTone[tone] : 'border-slate-200'}`}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-center text-xl font-bold text-slate-900">{children}</h1>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-center text-sm text-slate-600">{children}</p>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <span className="mt-0.5 text-brand-teal/70">{icon}</span>
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-desk-travel px-4 py-10">{children}</main>;
}
