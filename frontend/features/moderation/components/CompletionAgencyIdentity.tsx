'use client';
import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import type { CompletionAgency } from '../api/completionReaderApi';

export function CompletionAgencyIdentity({ agency, prominent = false }: { agency: CompletionAgency; prominent?: boolean }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initials = agency.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('vi');
  const Heading = prominent ? 'h1' : 'h2';
  return <div className="flex min-w-0 items-center gap-4">
    <div className="relative shrink-0 rounded-full border border-teal-200 p-1">
      {agency.avatarUrl && agency.avatarUrl !== failedAvatar ? <img src={agency.avatarUrl} alt={`Avatar ${agency.name}`} onError={() => setFailedAvatar(agency.avatarUrl)} className="h-14 w-14 rounded-full object-cover" />
        : <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white">{initials || 'A'}</span>}
      {agency.verified && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-teal-700 p-0.5 text-white"><Check className="h-3.5 w-3.5" /></span>}
    </div>
    <div className="min-w-0 space-y-1.5">
      <Heading className={`break-words font-bold leading-snug text-slate-900 ${prominent ? 'text-xl sm:text-2xl' : 'text-lg'}`}>{agency.name}</Heading>
      <p className="text-sm text-teal-800">{agency.verified ? 'Agency đã xác minh' : 'Agency chưa xác minh'}</p>
      {agency.address && <p className="flex items-start gap-1.5 text-sm leading-5 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{agency.address}</span></p>}
    </div>
  </div>;
}
