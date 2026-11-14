export default function AgencyLoading() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6" role="status" aria-live="polite">
      <h1 className="text-xl font-semibold text-[#143b40]">Đang mở trang…</h1>
      <div className="h-32 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" aria-hidden="true" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" aria-hidden="true" />
    </main>
  );
}
