'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MessageSquare, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useGetAdminUsersQuery } from '../api/adminApi';
import { useStartConversationMutation } from '@/features/chat/api';
import { AdminFrame, Feedback, adminError, panel, useAdminSession } from './AdminUi';
import { AdminUsersSkeleton } from './AdminSkeletons';

export function AdminAgencyChatPage() {
  const { ready } = useAdminSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const users = useGetAdminUsersQuery({ page: 1, limit: 100, role: 'AGENCY', status: 'ACTIVE', q: search || undefined }, { skip: !ready, refetchOnMountOrArgChange: true });
  const [start, startState] = useStartConversationMutation();
  if (!ready) return null;

  const openChat = async (agencyId: string) => {
    setError(null);
    try {
      const conversation = await start({ participantId: agencyId }).unwrap();
      router.push(`/conversations/${conversation.id}`);
    } catch (reason) { setError(adminError(reason)); }
  };

  return <AdminFrame title="Nhắn tin" description="Chọn công ty lữ hành để mở cuộc trò chuyện riêng." error={users.error} loading={!users.currentData} loadingSkeleton={<AdminUsersSkeleton />} refreshing={users.isFetching && !!users.currentData} onRefresh={() => users.refetch()}>
    <Feedback error={error} />
    <section className={`${panel} !p-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div><h2 className="font-semibold text-slate-900">Danh sách agency đang hoạt động</h2><p className="mt-1 text-sm text-slate-600">Mỗi cuộc trò chuyện chỉ hiển thị cho bạn và agency tương ứng.</p></div>
        <label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><span className="sr-only">Tìm agency</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc email..." className="pl-9" /></label>
      </div>
      <div className="divide-y divide-slate-100">{users.currentData?.items.map((agency) => <div key={agency.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700"><Building2 size={19}/></span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{agency.fullName}</p><p className="truncate text-sm text-slate-500">{agency.email}</p></div></div><Button className="inline-flex shrink-0 items-center justify-center gap-2" disabled={startState.isLoading} onClick={() => void openChat(agency.id)}><MessageSquare size={16}/>{startState.isLoading ? 'Đang mở...' : 'Mở cuộc trò chuyện'}</Button></div>)}
        {users.currentData?.items.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Không tìm thấy agency đang hoạt động.</p>}
      </div>
    </section>
  </AdminFrame>;
}
