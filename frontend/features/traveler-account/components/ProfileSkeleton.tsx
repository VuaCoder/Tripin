export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-8" role="status" aria-label="Đang tải thông tin tài khoản">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-surface-container-high" />
        <div className="h-7 w-56 rounded-lg bg-surface-container-high" />
        <div className="h-4 w-full max-w-md rounded bg-surface-container" />
      </div>
      <div className="flex items-center gap-5 rounded-2xl bg-surface-container-low p-6">
        <div className="h-24 w-24 rounded-full bg-surface-container-high" />
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-surface-container-high" />
          <div className="h-5 w-32 rounded-full bg-surface-container" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-surface-container-high" />
            <div className="h-5 w-full max-w-56 rounded bg-surface-container" />
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
