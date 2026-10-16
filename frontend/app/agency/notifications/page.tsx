import { AgencyNotificationInbox } from '@/features/agency/components/AgencyNotificationInbox';
export default function AgencyNotificationsPage() {
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><header className="mb-7"><h1 className="text-2xl font-bold text-slate-900">Thông báo</h1><p className="mt-2 text-sm text-slate-600">Cập nhật đặt chỗ, tour và phản hồi dành riêng cho Agency của bạn.</p></header><AgencyNotificationInbox /></main>;
}
