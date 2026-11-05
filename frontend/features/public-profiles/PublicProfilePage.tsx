'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BadgeCheck, Building2, ChevronRight, Globe, MapPin, UserRound } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';
import { ReviewCard } from '@/features/review/components/ReviewCard';
import { initialsOf } from '@/features/review/components/ReviewCard';
import type { ReviewSort } from '@/features/review/types';
import { useGetPublicProfileQuery, useGetProfileReviewsQuery, type ProfileKind } from './api';
import { AgencyVouchersSection } from './components/AgencyVouchersSection';
import { AgencyToursSection } from './components/AgencyToursSection';
import { PremiumFrame } from '@/features/premium/PremiumIdentity';
import { usePublicGuidePremiumQuery } from '@/features/premium/api';
import { PublicPremiumPortfolio } from '@/features/premium/PublicPremiumPortfolio';

export function safeWebsite(value?: string): string | undefined {
  try {
    const url = new URL(value ?? '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

function ProfileAvatar({ name, url }: { name: string; url?: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed
    // Public avatars may be hosted by any configured image provider.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={name} className="size-28 shrink-0 rounded-2xl bg-slate-100 object-cover" onError={() => setFailed(true)} />
    : <span aria-hidden="true" className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-3xl font-bold text-teal-900">{initialsOf(name)}</span>;
}

function PublicReviews({ kind, id }: { kind: ProfileKind; id: string }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const { currentData: data, isFetching, isError, refetch } = useGetProfileReviewsQuery({ kind, id, page, sort });
  return <section aria-labelledby="public-reviews-heading" className="mt-10 border-t border-slate-200 pt-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 id="public-reviews-heading" className="text-2xl font-bold text-slate-900">Đánh giá từ du khách</h2>
      <label className="flex items-center gap-2 text-sm text-slate-600">Sắp xếp
        <select className="rounded-lg border border-slate-300 bg-white p-2 focus-visible:outline-teal-700" value={sort} onChange={event => { setSort(event.target.value as ReviewSort); setPage(1); }}>
          <option value="newest">Mới nhất</option><option value="rating_desc">Điểm cao nhất</option><option value="rating_asc">Điểm thấp nhất</option>
        </select>
      </label>
    </div>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{kind === 'guide' ? 'Cảm nhận về các chuyến đi mà hướng dẫn viên đã dẫn. Điểm đánh giá dành cho toàn bộ trải nghiệm tour.' : 'Cảm nhận từ du khách đã hoàn thành chuyến đi do đơn vị tổ chức.'}</p>
    <div className="mt-6 space-y-4" aria-busy={isFetching} aria-live="polite">
      {isError ? <ErrorState title="Không tải được đánh giá" message="Vui lòng thử lại." onAction={() => void refetch()} /> : !data ? <LoadingState label="Đang tải đánh giá…" /> : <>
        <p className="text-sm text-slate-600">{data.meta?.total ?? data.items.length} đánh giá công khai</p>
        {!data.items.length && <EmptyState title="Chưa có đánh giá công khai" description="Đánh giá từ các chuyến đi sẽ xuất hiện tại đây khi được chia sẻ." />}
        {data.items.map(review => <div key={review.id}><ReviewCard review={review} /><Link href={`/tours/${review.tourId}`} className="mt-2 inline-block text-sm font-semibold text-teal-800 underline underline-offset-4">Xem tour được đánh giá</Link></div>)}
      </>}
    </div>
    {(page > 1 || (data?.meta?.totalPages ?? 0) > 1) && <nav aria-label="Phân trang đánh giá" className="mt-6 flex flex-wrap items-center gap-4">
      <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" disabled={page <= 1 || isFetching} onClick={() => setPage(value => value - 1)}>Trang trước</button>
      <span className="text-sm">Trang {page}{data?.meta ? ` / ${data.meta.totalPages}` : ''}</span>
      <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" disabled={isFetching || !data || page >= (data.meta?.totalPages ?? 1)} onClick={() => setPage(value => value + 1)}>Trang sau</button>
    </nav>}
  </section>;
}

export function PublicProfilePage({ kind }: { kind: ProfileKind }) {
  const { id } = useParams<{ id: string }>();
  const premium = usePublicGuidePremiumQuery(id,{ skip:kind !== 'guide' || !id, pollingInterval:30_000 });
  const { currentData: profile, isLoading, isFetching, error, refetch } = useGetPublicProfileQuery({ kind, id }, { skip: !id });
  if (isLoading || (isFetching && !profile)) return <LoadingState label="Đang tải hồ sơ…" />;
  if (error || !profile) {
    const missing = error && 'status' in error && (error.status === 404 || error.status === 400);
    return <ErrorState title={missing ? 'Không tìm thấy hồ sơ' : 'Không tải được hồ sơ'} message={missing ? 'Hồ sơ không tồn tại hoặc hiện không được công khai.' : 'Vui lòng kiểm tra kết nối và thử lại.'} actionLabel="Thử lại" onAction={() => void refetch()} />;
  }
  const name = kind === 'agency' ? profile.companyName || profile.fullName : profile.fullName;
  const bio = kind === 'agency' ? profile.description : profile.bio;
  const website = safeWebsite(profile.website);
  const Icon = kind === 'agency' ? Building2 : UserRound;
  return <div className="mx-auto max-w-5xl pb-8">
    <nav aria-label="Đường dẫn" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-600"><Link href="/tours" className="hover:text-teal-800 hover:underline">Khám phá tour</Link><ChevronRight size={14} /><span>{name}</span></nav>
    <header className="flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-center">
      <PremiumFrame active={!premium.isError && premium.currentData?.active} rounded><ProfileAvatar key={profile.avatarUrl ?? profile.id} name={name} url={profile.avatarUrl} /></PremiumFrame>
      <div className="min-w-0"><h1 className="break-words text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{name}</h1><p className="mt-3 flex items-center gap-2 text-slate-600"><Icon size={18} />{kind === 'agency' ? 'Đơn vị tổ chức tour' : 'Hướng dẫn viên du lịch'}</p>
        {kind === 'agency' && profile.verified && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-teal-800"><BadgeCheck size={18} />Đối tác đã xác minh</p>}
      </div>
    </header>
    <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
      <section aria-labelledby="profile-about"><h2 id="profile-about" className="text-xl font-bold text-slate-900">{kind === 'agency' ? 'Về đơn vị tổ chức' : 'Giới thiệu'}</h2><p className="mt-4 max-w-prose whitespace-pre-line break-words text-base leading-7 text-slate-700">{bio || 'Thông tin giới thiệu đang được cập nhật.'}</p></section>
      <aside className="space-y-5 border-t border-slate-200 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0" aria-label="Thông tin công khai">
        {kind === 'agency' ? <>
          <div><h2 className="font-semibold text-slate-900">Địa chỉ</h2><p className="mt-2 flex items-start gap-2 break-words text-sm leading-6 text-slate-600"><MapPin size={17} className="mt-1 shrink-0" />{profile.address || 'Đang cập nhật'}</p></div>
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 underline underline-offset-4"><Globe size={17} />Website chính thức<span className="sr-only"> (mở trong tab mới)</span></a>}
        </> : <>
          <div><h2 className="font-semibold text-slate-900">Kinh nghiệm</h2><p className="mt-2 text-sm text-slate-600">{profile.experienceYears === undefined ? 'Đang cập nhật' : `${profile.experienceYears} năm`}</p></div>
          <div><h2 className="font-semibold text-slate-900">Ngôn ngữ</h2><p className="mt-2 break-words text-sm text-slate-600">{profile.languages?.join(', ') || 'Đang cập nhật'}</p></div>
          <div><h2 className="font-semibold text-slate-900">Chuyên môn</h2><p className="mt-2 break-words text-sm text-slate-600">{profile.specialties?.join(', ') || 'Đang cập nhật'}</p></div>
        </>}
      </aside>
    </div>
    {kind === 'agency' && (
      <>
        <AgencyVouchersSection agencyId={id} agencyName={name} />
        <AgencyToursSection agencyId={id} agencyName={name} />
      </>
    )}
    {kind === 'guide' && !premium.isError && premium.currentData?.active && premium.currentData.profile && <PublicPremiumPortfolio profile={premium.currentData.profile} />}
    <PublicReviews key={`${kind}-${id}`} kind={kind} id={id} />
  </div>;
}
