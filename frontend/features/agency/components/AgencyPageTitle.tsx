import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function AgencyPageTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <h1 className="flex items-center gap-[11px] text-[26px] font-[750] leading-[1.4] tracking-[-0.035em] text-[#143b40]">
    <Icon size={27} className="shrink-0 text-[#087e8b]" aria-hidden="true" />
    {children}
  </h1>;
}
