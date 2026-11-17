import AdminAgencyFinancePage from '@/features/agency-finance/AdminAgencyFinancePage';
export default function Page({params}:{params:{agencyId:string}}){return <AdminAgencyFinancePage agencyId={params.agencyId}/>;}
