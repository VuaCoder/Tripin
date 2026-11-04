'use client';

export function TypingBubble({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="flex justify-start">
    <div aria-hidden="true" className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
      {[0, 150, 300].map(delay => <span key={delay} className="size-2 rounded-full bg-teal-700 motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}
    </div>
  </div>;
}
