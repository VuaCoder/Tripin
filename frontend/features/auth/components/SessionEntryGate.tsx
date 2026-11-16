'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { homeForRole } from '../utils/roles';
import { authNextPath } from '../utils/safeNextPath';

function SessionLoading() {
  return <div role="status" className="flex min-h-48 items-center justify-center p-6 text-sm text-slate-600">Đang kiểm tra phiên đăng nhập…</div>;
}

export function SessionRecovery() {
  const error = useAppSelector(s => s.auth.bootstrapError);
  if (!error) return <SessionLoading />;
  return <div role="alert" className="mx-auto max-w-lg space-y-4 p-6 text-center text-slate-700"><p>{error}</p>
    <button type="button" className="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      onClick={() => window.dispatchEvent(new Event('tripri:retry-session'))}>Thử lại</button></div>;
}

/** Guest entry points wait for bootstrap, then replace themselves with the authenticated destination. */
export function SessionEntryGate({ children, target }: { children: ReactNode; target?: string | null }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const status = useAppSelector(s => s.auth.status);
  const role = useAppSelector(s => s.auth.user?.role);
  const destination = authNextPath(target ?? null, homeForRole(role));
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && status === 'authenticated') router.replace(destination); }, [mounted, status, destination, router]);
  // Bootstrap can settle before Next hydrates this Suspense boundary. Its first
  // client render must still match the server, regardless of the live store.
  if (!mounted) return <SessionLoading />;
  if (status === 'idle') return <SessionRecovery />;
  if (status === 'authenticated') return <div role="status" className="p-6 text-center text-sm text-slate-600">Đang mở trang chính…</div>;
  return <>{children}</>;
}
