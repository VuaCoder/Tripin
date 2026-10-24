import { CircleAlert } from 'lucide-react';

export function RequiredMark() {
  return null;
}

export function TourFieldHint({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"><CircleAlert size={16} className="mt-1 shrink-0" aria-hidden="true" /><span>{message}</span></p>;
}
