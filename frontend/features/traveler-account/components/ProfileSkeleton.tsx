export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-surface-dim"></div>
        <div className="space-y-2">
          <div className="h-6 bg-surface-dim rounded w-48"></div>
          <div className="h-4 bg-surface-dim rounded w-32"></div>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-4 bg-surface-dim rounded w-24"></div>
            <div className="h-10 bg-surface-dim rounded w-full max-w-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
