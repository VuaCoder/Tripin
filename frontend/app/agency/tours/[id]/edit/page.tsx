import { Suspense } from 'react';
import { AgencyTourEditorPage } from '@/features/tours';

export default function EditAgencyTourRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12 text-center text-slate-500 font-medium">Đang tải...</div>}>
      <AgencyTourEditorPage mode="edit" />
    </Suspense>
  );
}
