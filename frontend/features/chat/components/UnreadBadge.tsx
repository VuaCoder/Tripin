export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-label={`${count} tin chưa đọc`} className="inline-flex shrink-0 items-center gap-1.5">
    <span aria-hidden="true" className="size-2 rounded-full bg-primary-container" />
    <span aria-hidden="true" className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-bold text-white">{count > 99 ? '99+' : count}</span>
  </span>;
}
