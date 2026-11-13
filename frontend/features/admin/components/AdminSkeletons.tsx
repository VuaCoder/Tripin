import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import sidebarStyles from '@/features/agency/components/AgencySidebar.module.css';
import styles from './AdminSkeletons.module.css';

const surface = 'rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6';

export function Shimmer({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`${styles.shimmer} block rounded-md ${className}`} />;
}

function SkeletonStatus({ children }: { children: ReactNode }) {
  return <div role="status" aria-label="Đang tải nội dung trang quản trị" className="space-y-5">
    <span className="sr-only">Đang tải nội dung trang quản trị</span>{children}
  </div>;
}

export function AdminFallbackSkeleton() {
  return <SkeletonStatus><div className={`${surface} space-y-4`}><Shimmer className="h-5 w-40" /><Shimmer className="h-11 w-full rounded-xl" /><Shimmer className="h-48 w-full" /></div></SkeletonStatus>;
}

function TableRows({ rows = 6, cells = 5, minWidth, titleBar = false }: { rows?: number; cells?: number; minWidth?: number; titleBar?: boolean }) {
  return <div className={minWidth ? 'overflow-x-auto' : undefined}><div className={`${surface} !p-0`} style={minWidth ? { minWidth } : undefined}>
    {titleBar && <div className="flex h-14 items-center border-b border-slate-100 px-5"><Shimmer className="h-4 w-36" /></div>}
    <div className="flex h-12 items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-5">
      {Array.from({ length: cells }, (_, i) => <Shimmer key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-20'}`} />)}
    </div>
    {Array.from({ length: rows }, (_, row) => <div key={row} className="grid min-h-[76px] items-center gap-4 border-b border-slate-100 px-5 last:border-0" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}>
      {Array.from({ length: cells }, (_, cell) => <div key={cell} className="flex min-w-0 items-center gap-3">
        {cell === 0 && <Shimmer className="size-10 shrink-0 rounded-full" />}
        <div className="min-w-0 flex-1 space-y-2"><Shimmer className="h-3 w-3/4" />{(cell === 0 || cell === 1) && <Shimmer className="h-3 w-1/2" />}</div>
      </div>)}
    </div>)}
  </div></div>;
}

export function AdminUsersSkeleton() {
  return <SkeletonStatus>
    <Shimmer className="h-11 w-44 rounded-xl" />
    <div className={`${surface} grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]`}>
      <div className="space-y-2"><Shimmer className="h-3 w-28" /><Shimmer className="h-11 w-full rounded-xl" /></div>
      <div className="space-y-2"><Shimmer className="h-3 w-20" /><Shimmer className="h-11 w-full rounded-xl" /></div>
      <div className="space-y-2"><Shimmer className="h-3 w-24" /><Shimmer className="h-11 w-full rounded-xl" /></div>
      <Shimmer className="h-3 w-64 sm:col-span-2 lg:col-span-3" />
    </div>
    <TableRows rows={7} cells={5} minWidth={760} titleBar />
    <div className="flex justify-end gap-2"><Shimmer className="h-9 w-24 rounded-lg" /><Shimmer className="h-9 w-24 rounded-lg" /></div>
  </SkeletonStatus>;
}

export function AdminCategoriesSkeleton({ viewMode = 'grid' }: { viewMode?: 'grid' | 'list' }) {
  return <SkeletonStatus>
    <div className="flex items-center justify-between"><Shimmer className="h-4 w-36" /><Shimmer className="h-9 w-28 rounded-lg" /></div>
    <div className={`${surface} grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]`}>
      {Array.from({ length: 3 }, (_, i) => <Shimmer key={i} className="h-11 rounded-xl" />)}
    </div>
    {viewMode === 'list' ? <TableRows rows={6} cells={5} minWidth={700} /> : <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${surface} space-y-5`}><div className="flex justify-between"><Shimmer className="h-5 w-40" /><Shimmer className="h-6 w-24 rounded-full" /></div><Shimmer className="h-4 w-32" /><Shimmer className="h-12 w-full" /><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Shimmer className="size-9 rounded-lg" /><Shimmer className="size-9 rounded-lg" /></div></div>)}
    </div>}
  </SkeletonStatus>;
}

export function AdminPromotionsSkeleton() {
  return <SkeletonStatus>
    <div className={`${surface} grid gap-4 sm:grid-cols-2 xl:grid-cols-3`}>
      {Array.from({ length: 6 }, (_, i) => <Shimmer key={i} className="h-11 rounded-xl" />)}
    </div>
    <div className="flex items-center justify-between"><Shimmer className="h-4 w-32" /><Shimmer className="h-4 w-24" /></div>
    <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`${surface} flex flex-wrap items-start justify-between gap-5`}><div className="min-w-0 flex-1 space-y-3"><Shimmer className="h-5 w-64 max-w-full" /><Shimmer className="h-4 w-48 max-w-full" /><Shimmer className="h-4 w-80 max-w-full" /><Shimmer className="h-4 w-52 max-w-full" /></div><div className="flex gap-2"><Shimmer className="size-9 rounded-lg" /><Shimmer className="size-9 rounded-lg" /><Shimmer className="size-9 rounded-lg" /></div></div>)}</div>
    <div className="flex justify-end gap-2"><Shimmer className="h-9 w-24 rounded-lg" /><Shimmer className="h-9 w-24 rounded-lg" /></div>
  </SkeletonStatus>;
}

export function AdminCommissionSkeleton() {
  return <SkeletonStatus><section className={`${surface} space-y-6`}><Shimmer className="h-4 w-72 max-w-full" /><div className="max-w-lg space-y-4"><div className="space-y-2"><Shimmer className="h-3 w-40" /><Shimmer className="h-11 w-full rounded-xl" /></div><Shimmer className="h-10 w-32 rounded-xl" /></div></section></SkeletonStatus>;
}

export function AdminPoliciesSkeleton() {
  return <SkeletonStatus>
    <div className={`${surface} grid gap-4 sm:grid-cols-[2fr_1fr_auto]`}><Shimmer className="h-11 rounded-xl" /><Shimmer className="h-11 rounded-xl" /><Shimmer className="h-10 w-24 rounded-xl" /></div>
    <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 5 }, (_, i) => <section key={i} className={`${surface} space-y-4`}><Shimmer className="h-5 w-40" /><Shimmer className="h-3 w-28" /><Shimmer className="h-5 w-3/4" /><Shimmer className="h-24 w-full" /><Shimmer className="h-4 w-full" /><Shimmer className="h-4 w-2/3" /><div className="flex gap-2"><Shimmer className="size-9 rounded-lg" /><Shimmer className="size-9 rounded-lg" /></div></section>)}</div>
  </SkeletonStatus>;
}

export function AdminAuditSkeleton() {
  return <SkeletonStatus>
    <div className={`${surface} flex flex-wrap items-end gap-3`}><Shimmer className="h-16 w-48 rounded-lg" /><Shimmer className="h-16 w-48 rounded-lg" /><Shimmer className="h-10 w-36 rounded-xl" /><Shimmer className="h-10 w-40 rounded-xl" /></div>
    <TableRows rows={8} cells={4} />
    <div className="flex justify-end gap-2"><Shimmer className="h-9 w-24 rounded-lg" /><Shimmer className="h-9 w-24 rounded-lg" /></div>
  </SkeletonStatus>;
}

export function AdminDashboardSkeleton() {
  return <SkeletonStatus>
    <div className="flex items-center justify-between"><Shimmer className="h-5 w-44" /><Shimmer className="h-8 w-1/2 rounded-lg" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <section key={i} className={`${surface} space-y-5`}><div className="flex justify-between"><Shimmer className="h-4 w-32" /><Shimmer className="size-9 rounded-lg" /></div><Shimmer className="h-7 w-40" /><Shimmer className="h-3 w-36" /></section>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]"><section className={`${surface} space-y-5`}><Shimmer className="h-5 w-44" /><Shimmer className="h-64 w-full" /></section><div className="space-y-5"><section className={`${surface} space-y-4`}><Shimmer className="h-4 w-48" /><Shimmer className="h-9 w-20" /><Shimmer className="h-4 w-full" /></section><section className={`${surface} space-y-4`}><Shimmer className="h-5 w-44" /><Shimmer className="mx-auto size-40 rounded-full" /></section></div></div>
    <div className="flex items-center justify-between border-b border-slate-200 pb-3"><Shimmer className="h-5 w-48" /><Shimmer className="h-3 w-1/2" /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className={`${surface} flex items-center gap-4`}><Shimmer className="size-11 rounded-xl" /><div className="flex-1 space-y-3"><Shimmer className="h-3 w-32" /><Shimmer className="h-6 w-20" /></div></div>)}</div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <section key={i} className={`${surface} space-y-4`}><Shimmer className="h-5 w-44" /><Shimmer className="h-52 w-full" /></section>)}</div>
  </SkeletonStatus>;
}

export function AdminPremiumSkeleton() {
  return <SkeletonStatus>
    <section className="space-y-4"><Shimmer className="h-6 w-48" /><div className="flex gap-8"><Shimmer className="h-5 w-36" /><Shimmer className="h-5 w-32" /></div></section>
    <section className="space-y-4"><Shimmer className="h-6 w-56" /><div className={`${surface} grid gap-5 sm:grid-cols-2`}>{Array.from({ length: 8 }, (_, i) => <div key={i} className="space-y-2"><Shimmer className="h-3 w-36" /><Shimmer className="h-11 w-full rounded-lg" /></div>)}<Shimmer className="h-24 rounded-lg sm:col-span-2" /><Shimmer className="h-10 w-36 rounded-lg" /></div></section>
    {['Nguồn voucher', 'Các phiên bản gói', 'Yêu cầu hoàn tiền'].map((title) => <section key={title} className="space-y-4"><Shimmer className="h-6 w-52" />{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center justify-between gap-4 border-b border-slate-200 py-5"><div className="flex-1 space-y-3"><Shimmer className="h-4 w-56 max-w-full" /><Shimmer className="h-3 w-80 max-w-full" /><Shimmer className="h-3 w-64 max-w-full" /></div><Shimmer className="h-9 w-24 rounded-lg" /></div>)}</section>)}
  </SkeletonStatus>;
}

export function AdminAccessSkeleton() {
  const pathname = usePathname() ?? '/super-admin';
  const pageSkeleton = pathname.includes('/users') ? <AdminUsersSkeleton />
    : pathname.includes('/categories') ? <AdminCategoriesSkeleton />
      : pathname.includes('/promotions') ? <AdminPromotionsSkeleton />
        : pathname.includes('/commission') ? <AdminCommissionSkeleton />
          : pathname.includes('/policies') ? <AdminPoliciesSkeleton />
            : pathname.includes('/audit-logs') ? <AdminAuditSkeleton />
              : pathname.includes('/premium') ? <AdminPremiumSkeleton />
                : <AdminDashboardSkeleton />;
  return <div className={`${sidebarStyles.shell} min-h-screen bg-[#f7f8f5]`} aria-busy="true">
    <aside aria-hidden="true" className={sidebarStyles.sidebar}>
      <div className={sidebarStyles.header}><Shimmer className={`size-11 rounded-xl ${styles.sidebarShimmer}`} /></div>
      <div className="mt-7 space-y-6">
        {['Theo dõi', 'Tài khoản và tour', 'Cấu hình'].map((group) => <div key={group} className="space-y-3 border-b border-white/10 pb-5">
          <Shimmer className={`h-3 w-24 ${styles.sidebarShimmer}`} />
          {Array.from({ length: group === 'Theo dõi' ? 2 : 3 }, (_, i) => <div key={i} className="flex h-10 items-center gap-3 px-2"><Shimmer className={`size-5 rounded-md ${styles.sidebarShimmer}`} /><Shimmer className={`h-3 flex-1 ${styles.sidebarShimmer}`} /></div>)}
        </div>)}
      </div>
      <div className={`${sidebarStyles.footer} mt-auto`}><Shimmer className={`size-10 rounded-full ${styles.sidebarShimmer}`} /></div>
    </aside>
    <div className={`${sidebarStyles.body} w-full`}>
      <main className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5"><Shimmer className="h-8 w-64 max-w-[70%]" /><Shimmer className="size-10 rounded-xl" /></header>
        {pageSkeleton}
      </main>
    </div>
  </div>;
}
