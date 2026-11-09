export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-label={`${count} tin chưa đọc`} className="inline-flex shrink-0 items-center">
    <span aria-hidden="true" className="size-2.5 rounded-full bg-primary-container" />
  </span>;
}
