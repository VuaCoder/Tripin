import AdminFinancePage from '@/features/agency-finance/AdminFinancePage';
import { Suspense } from 'react';
export default function Page(){return <Suspense fallback={<p>Đang tải kế toán…</p>}><AdminFinancePage/></Suspense>;}
