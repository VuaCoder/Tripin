'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAgencies, selectAgency, selectActiveAgency } from '@/features/auth/store/authSlice';

export function AgencySelector() {
  const agencies = useAppSelector(selectAgencies);
  const active = useAppSelector(selectActiveAgency);
  const dispatch = useAppDispatch();
  if (!agencies?.length) return null;
  return <label className="block min-w-0 text-sm font-medium text-slate-700">
    Doanh nghiệp đang truy cập
    <select aria-label="Doanh nghiệp đang truy cập" value={active?.agencyId ?? ''}
      onChange={event => dispatch(selectAgency(event.target.value))}
      className="mt-2 block min-h-11 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
      <option value="" disabled>Chọn doanh nghiệp</option>
      {agencies.map(agency => <option key={agency.agencyId} value={agency.agencyId}>{agency.companyName} — {agency.memberRole}</option>)}
    </select>
  </label>;
}
