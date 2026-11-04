'use client';
import { useState, type FormEvent } from 'react';
import { RoleGuard, selectUser } from '@/features/auth';
import { useAppSelector } from '@/store/hooks';
import { useGetAgencyToursQuery } from '@/features/tours/api/toursApi';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  usePremiumMutationMutation,
  usePremiumResourceQuery,
  type PremiumPlan,
} from './api';
import { premiumInput, premiumButton, premiumMoney, Retry } from './ui';
import { PremiumOperations } from './PremiumOperations';

interface Contribution {
  id: string;
  title: string;
  agencyId: string;
  status: string;
  acceptingNew: boolean;
  capacity: number;
  reserved: number;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  tourIds: string[];
}
interface Refund {
  id: string;
  subscriptionId: string;
  userId: string;
  amount: number;
  reason: string;
  status: string;
  transferReference?: string;
}
const statusLabel: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  REQUESTED: 'Chờ duyệt',
  COMPLETED: 'Đã chuyển tiền hoàn',
};

export function PremiumManagement({ admin = false }: { admin?: boolean }) {
  const user = useAppSelector(selectUser);
  return (
    <RoleGuard allowedRoles={admin ? ['SUPER_ADMIN'] : ['AGENCY']}>
      <ManagementContent key={user?.id ?? 'guest'} admin={admin} />
    </RoleGuard>
  );
}
function ManagementContent({ admin }: { admin: boolean }) {
  const prefix = admin ? '/admin/premium' : '/agency/premium';
  const contributions = usePremiumResourceQuery(`${prefix}/contributions`);
  const plans = usePremiumResourceQuery('/admin/premium/plans', {
    skip: !admin,
  });
  const refunds = usePremiumResourceQuery('/admin/premium/refunds', {
    skip: !admin,
  });
  const flags = usePremiumResourceQuery('/admin/premium/flags', {
    skip: !admin,
  });
  const usage = usePremiumResourceQuery('/agency/premium/usage', {
    skip: admin,
  });
  const [tourPage, setTourPage] = useState(1);
  const tours = useGetAgencyToursQuery(
    { page: tourPage, limit: 20 },
    { skip: admin },
  );
  const [mutate, state] = usePremiumMutationMutation();
  const [feedback, setFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const [selectedTours, setSelectedTours] = useState<string[]>([]);
  const [voucherQuantities, setVoucherQuantities] = useState<
    Record<string, number>
  >({});
  const [audience, setAudience] = useState('TRAVELER');
  const [review, setReview] = useState<{
    id: string;
    action: 'APPROVE' | 'REJECT' | 'COMPLETE';
  } | null>(null);
  const sources = contributions.currentData as Contribution[] | undefined;
  const planList = plans.currentData as PremiumPlan[] | undefined;
  const refundList = refunds.currentData as Refund[] | undefined;
  const flagList = flags.currentData as
    | { key: string; value: boolean }[]
    | undefined;
  const usageList = usage.currentData as
    | {
        id: string;
        title: string;
        capacity: number;
        committed: number;
        used: number;
      }[]
    | undefined;
  const run = async (url: string, body?: unknown, method = 'POST') => {
    setFeedback(null);
    try {
      await mutate({ url, method, body }).unwrap();
      setFeedback({ error: false, text: 'Đã lưu thay đổi.' });
      return true;
    } catch (e) {
      setFeedback({
        error: true,
        text: getApiErrorMessage(
          e,
          'Không lưu được. Vui lòng kiểm tra dữ liệu và thử lại.',
        ),
      });
      return false;
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const get = (key: string) => String(values.get(key) ?? '');
    const num = (key: string) => Number(get(key));
    if (admin) {
      const ok = await run('/admin/premium/plans', {
        code: get('code'),
        name: get('name'),
        description: get('description'),
        audience,
        price: num('price'),
        durationDays: num('durationDays'),
        version: num('version'),
        benefits: get('benefits')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        vouchers:
          audience === 'TRAVELER'
            ? Object.entries(voucherQuantities)
                .filter(([, quantity]) => quantity > 0)
                .map(([contributionId, quantity]) => ({
                  contributionId,
                  quantity,
                }))
            : [],
      });
      if (ok) {
        form.reset();
        setVoucherQuantities({});
      }
    } else {
      if (!selectedTours.length) {
        setFeedback({
          error: true,
          text: 'Hãy chọn ít nhất một tour áp dụng.',
        });
        return;
      }
      const max = get('maxDiscountAmount');
      const ok = await run('/agency/premium/contributions', {
        acceptedTerms: true,
        title: get('title'),
        tourIds: selectedTours,
        discountType: get('discountType'),
        discountValue: num('discountValue'),
        ...(max ? { maxDiscountAmount: Number(max) } : {}),
        minOrderAmount: num('minOrderAmount'),
        capacity: num('capacity'),
      });
      if (ok) {
        form.reset();
        setSelectedTours([]);
      }
    }
  };
  return (
    <main className="mx-auto max-w-5xl space-y-9 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold">
          {admin ? 'Quản lý Premium' : 'Đóng góp voucher Premium'}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-slate-600">
          {admin
            ? 'Tạo phiên bản gói, duyệt nguồn voucher và quản lý yêu cầu hoàn tiền. Gói chỉ được mở bán khi đủ giá và quyền lợi.'
            : 'Agency chịu khoản giảm giá và cam kết hạn mức cho các kỳ đã bán. Ngừng đóng góp chỉ chặn giao dịch mới.'}
        </p>
      </header>
      {feedback && (
        <p
          role={feedback.error ? 'alert' : 'status'}
          className={`rounded-lg p-4 text-sm ${feedback.error ? 'bg-red-50 text-red-800' : 'bg-teal-50 text-teal-900'}`}
        >
          {feedback.text}
        </p>
      )}
      {admin && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Mở bán theo vai trò</h2>
          {flags.isError ? (
            <Retry onRetry={() => void flags.refetch()} />
          ) : flags.isLoading ? (
            <p role="status">Đang tải cấu hình…</p>
          ) : (
            ['TRAVELER', 'TOUR_GUIDE'].map((role) => (
              <label
                key={role}
                className="mr-6 inline-flex items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={state.isLoading}
                  checked={
                    flagList?.find((f) => f.key === `premium.enabled.${role}`)
                      ?.value === true
                  }
                  onChange={(e) =>
                    void run(
                      '/admin/premium/flags',
                      { audience: role, enabled: e.target.checked },
                      'PUT',
                    )
                  }
                />
                {role === 'TRAVELER' ? 'Traveler' : 'Guide'}
              </label>
            ))
          )}
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">
          {admin ? 'Tạo phiên bản Premium' : 'Đề xuất bộ voucher'}
        </h2>
        <form
          onSubmit={submit}
          className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2"
        >
          <fieldset disabled={state.isLoading} className="contents">
            {admin ? (
              <>
                <Field
                  label="Mã phiên bản (A–Z, số, gạch ngang)"
                  name="code"
                  required
                  maxLength={40}
                  pattern="[A-Z0-9_-]{3,40}"
                />
                <Field
                  label="Tên hiển thị"
                  name="name"
                  required
                  maxLength={120}
                />
                <label className="text-sm font-semibold">
                  Đối tượng
                  <select
                    className={premiumInput}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    <option value="TRAVELER">Traveler</option>
                    <option value="TOUR_GUIDE">Guide</option>
                  </select>
                </label>
                <Field
                  label="Phiên bản"
                  name="version"
                  type="number"
                  required
                  min={1}
                  defaultValue={1}
                />
                <Field
                  label="Giá VND"
                  name="price"
                  type="number"
                  required
                  min={1}
                  max={2000000000}
                />
                <Field
                  label="Thời hạn (ngày)"
                  name="durationDays"
                  type="number"
                  required
                  min={1}
                  max={366}
                />
                <label className="text-sm font-semibold sm:col-span-2">
                  Mô tả
                  <textarea
                    name="description"
                    className={premiumInput}
                    maxLength={2000}
                  />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Quyền lợi (mỗi dòng một quyền lợi)
                  <textarea
                    name="benefits"
                    required
                    className={premiumInput}
                    maxLength={6000}
                  />
                </label>
                {audience === 'TRAVELER' && (
                  <div className="space-y-3 sm:col-span-2">
                    <p className="text-sm font-semibold">
                      Voucher trong mỗi kỳ (tổng tối đa 500)
                    </p>
                    {contributions.isError ? (
                      <Retry onRetry={() => void contributions.refetch()} />
                    ) : (
                      sources
                        ?.filter(
                          (c) => c.status === 'APPROVED' && c.acceptingNew,
                        )
                        .map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span>
                              {c.title} · Còn {c.capacity - c.reserved} lượt cam
                              kết
                            </span>
                            <input
                              aria-label={`Số voucher ${c.title} mỗi kỳ`}
                              type="number"
                              min={0}
                              max={100}
                              className={premiumInput + ' max-w-24'}
                              value={voucherQuantities[c.id] ?? 0}
                              onChange={(e) =>
                                setVoucherQuantities({
                                  ...voucherQuantities,
                                  [c.id]: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ))
                    )}
                    {!sources?.some(
                      (c) => c.status === 'APPROVED' && c.acceptingNew,
                    ) && (
                      <p className="text-sm text-slate-600">
                        Chưa có nguồn voucher đã duyệt để chọn.
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-600 sm:col-span-2">
                  Phiên bản đã tạo được giữ nguyên điều kiện. Muốn đổi giá hoặc
                  quyền lợi, tạo phiên bản mới rồi ngừng bán phiên bản cũ.
                </p>
              </>
            ) : (
              <>
                <Field
                  label="Tên bộ voucher"
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                />
                <Field
                  label="Hạn mức cam kết (lượt voucher)"
                  name="capacity"
                  type="number"
                  required
                  min={1}
                  max={1000000}
                />
                <label className="text-sm font-semibold">
                  Hình thức giảm
                  <select name="discountType" className={premiumInput}>
                    <option value="PERCENT">Phần trăm</option>
                    <option value="FIXED">Số tiền VND</option>
                  </select>
                </label>
                <Field
                  label="Mức giảm (% hoặc VND)"
                  name="discountValue"
                  type="number"
                  required
                  min={1}
                  max={2000000000}
                />
                <Field
                  label="Giảm tối đa VND (bắt buộc với %)"
                  name="maxDiscountAmount"
                  type="number"
                  min={1}
                  max={2000000000}
                />
                <Field
                  label="Đơn tối thiểu VND"
                  name="minOrderAmount"
                  type="number"
                  required
                  min={0}
                  defaultValue={0}
                  max={2000000000}
                />
                <div className="space-y-3 sm:col-span-2">
                  <p className="text-sm font-semibold">Tour áp dụng</p>
                  {tours.isError ? (
                    <Retry onRetry={() => void tours.refetch()} />
                  ) : tours.isLoading ? (
                    <p role="status">Đang tải tour…</p>
                  ) : (
                    tours.currentData?.items.map((t) => (
                      <label key={t.id} className="flex gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedTours.includes(t.id)}
                          onChange={(e) =>
                            setSelectedTours(
                              e.target.checked
                                ? [...selectedTours, t.id]
                                : selectedTours.filter((id) => id !== t.id),
                            )
                          }
                        />
                        {t.title}
                      </label>
                    ))
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      disabled={tourPage <= 1}
                      onClick={() => setTourPage((p) => p - 1)}
                    >
                      Trang trước
                    </button>
                    <span>Trang {tourPage}</span>
                    <button
                      type="button"
                      disabled={
                        !tours.currentData ||
                        tourPage >= tours.currentData.meta.totalPages
                      }
                      onClick={() => setTourPage((p) => p + 1)}
                    >
                      Trang sau
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    Đã chọn {selectedTours.length} tour.
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm sm:col-span-2">
                  <input type="checkbox" required className="mt-1" />
                  Tôi đồng ý Agency chịu chi phí ưu đãi và giữ cam kết voucher
                  đối với các kỳ Premium đã bán.
                </label>
              </>
            )}
            <button className={premiumButton + ' justify-self-start'}>
              {state.isLoading
                ? 'Đang lưu…'
                : admin
                  ? 'Tạo bản nháp'
                  : 'Gửi admin duyệt'}
            </button>
          </fieldset>
        </form>
      </section>
      <section>
        <h2 className="text-xl font-bold">Nguồn voucher</h2>
        {contributions.isError ? (
          <Retry onRetry={() => void contributions.refetch()} />
        ) : !sources ? (
          <p role="status">Đang tải…</p>
        ) : !sources.length ? (
          <p className="mt-3 text-sm text-slate-600">
            Chưa có đóng góp voucher.
          </p>
        ) : (
          sources.map((c) => (
            <article
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 py-5"
            >
              <div>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {statusLabel[c.status]} ·{' '}
                  {c.acceptingNew ? 'Nhận giao dịch mới' : 'Đã ngừng'} · Đã
                  giữ/cam kết {c.reserved}/{c.capacity}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Giảm {c.discountValue}
                  {c.discountType === 'PERCENT' ? '%' : ' VND'} · Đơn từ{' '}
                  {premiumMoney(c.minOrderAmount)}
                  {c.maxDiscountAmount &&
                    ` · Tối đa ${premiumMoney(c.maxDiscountAmount)}`}
                </p>
              </div>
              <div className="flex gap-3">
                {admin && c.status === 'PENDING' && (
                  <>
                    <button
                      disabled={state.isLoading}
                      className={premiumButton}
                      onClick={() =>
                        void run(
                          `/admin/premium/contributions/${c.id}`,
                          { status: 'APPROVED' },
                          'PATCH',
                        )
                      }
                    >
                      Duyệt
                    </button>
                    <button
                      disabled={state.isLoading}
                      className="text-sm text-red-700 underline"
                      onClick={() =>
                        void run(
                          `/admin/premium/contributions/${c.id}`,
                          { status: 'REJECTED' },
                          'PATCH',
                        )
                      }
                    >
                      Từ chối
                    </button>
                  </>
                )}
                {!admin && c.acceptingNew && (
                  <button
                    disabled={state.isLoading}
                    className="text-sm text-red-700 underline"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Ngừng nhận giao dịch mới? Cam kết đã bán vẫn được giữ.',
                        )
                      )
                        void run(`/agency/premium/contributions/${c.id}/stop`);
                    }}
                  >
                    Ngừng đóng góp
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
      {admin && (
        <>
          <section>
            <h2 className="text-xl font-bold">Các phiên bản gói</h2>
            {plans.isError ? (
              <Retry onRetry={() => void plans.refetch()} />
            ) : plans.isLoading ? (
              <p role="status">Đang tải phiên bản gói…</p>
            ) : !planList?.length ? (
              <p className="mt-3 text-sm text-slate-600">
                Chưa có phiên bản Premium. Hãy tạo bản nháp để bắt đầu.
              </p>
            ) : (
              planList?.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b py-5"
                >
                  <div>
                    <h3 className="font-semibold">
                      {p.name} ·{' '}
                      {p.audience === 'TRAVELER' ? 'Traveler' : 'Guide'} · v
                      {p.version}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {premiumMoney(p.price)} / {p.durationDays} ngày ·{' '}
                      {p.published ? 'Đang mở bán' : 'Chưa mở bán'}
                    </p>
                  </div>
                  <button
                    disabled={state.isLoading}
                    className={premiumButton}
                    onClick={() =>
                      void run(
                        `/admin/premium/plans/${p.id}`,
                        { published: !p.published },
                        'PATCH',
                      )
                    }
                  >
                    {p.published ? 'Ngừng bán' : 'Mở bán'}
                  </button>
                </article>
              ))
            )}
          </section>
          <section>
            <h2 className="text-xl font-bold">Yêu cầu hoàn tiền</h2>
            {refunds.isError ? (
              <Retry onRetry={() => void refunds.refetch()} />
            ) : refunds.isLoading ? (
              <p role="status">Đang tải yêu cầu hoàn tiền…</p>
            ) : refundList?.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Chưa có yêu cầu hoàn tiền.
              </p>
            ) : (
              refundList?.map((r) => (
                <article key={r.id} className="space-y-2 border-b py-5">
                  <p className="font-semibold">
                    {premiumMoney(r.amount)} ·{' '}
                    {r.status === 'APPROVED'
                      ? 'Chờ chuyển tiền hoàn'
                      : (statusLabel[r.status] ?? r.status)}
                  </p>
                  <p className="break-all text-xs text-slate-500">
                    Tài khoản {r.userId} · Kỳ {r.subscriptionId}
                  </p>
                  <p className="text-sm">{r.reason}</p>
                  {r.transferReference && (
                    <p className="text-sm">Tham chiếu: {r.transferReference}</p>
                  )}
                  <div className="flex gap-4">
                    {r.status === 'REQUESTED' && (
                      <>
                        <button
                          disabled={state.isLoading}
                          className={premiumButton}
                          onClick={() =>
                            setReview({ id: r.id, action: 'APPROVE' })
                          }
                        >
                          Duyệt hoàn
                        </button>
                        <button
                          disabled={state.isLoading}
                          className="text-sm text-red-700 underline"
                          onClick={() =>
                            setReview({ id: r.id, action: 'REJECT' })
                          }
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button
                        className={premiumButton}
                        onClick={() =>
                          setReview({ id: r.id, action: 'COMPLETE' })
                        }
                      >
                        Ghi nhận đã chuyển tiền
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
            {review && (
              <form
                className="mt-5 space-y-3 rounded-xl bg-slate-50 p-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  if (
                    await run(
                      `/admin/premium/refunds/${review.id}`,
                      {
                        action: review.action,
                        note: String(form.get('note')),
                        ...(review.action === 'COMPLETE'
                          ? { transferReference: String(form.get('reference')) }
                          : {}),
                      },
                      'PATCH',
                    )
                  )
                    setReview(null);
                }}
              >
                <h3 className="font-semibold">
                  {review.action === 'COMPLETE'
                    ? 'Xác nhận đã chuyển tiền thực tế'
                    : review.action === 'APPROVE'
                      ? 'Duyệt và thu hồi kỳ chưa bắt đầu'
                      : 'Từ chối yêu cầu'}
                </h3>
                <Field
                  label="Ghi chú xử lý"
                  name="note"
                  required
                  minLength={3}
                  maxLength={1000}
                />
                {review.action === 'COMPLETE' && (
                  <Field
                    label="Mã tham chiếu chuyển tiền"
                    name="reference"
                    required
                    minLength={3}
                    maxLength={200}
                  />
                )}
                <div className="flex gap-4">
                  <button className={premiumButton} disabled={state.isLoading}>
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => setReview(null)}
                  >
                    Đóng
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
      {!admin && (
        <section>
          <h2 className="text-xl font-bold">Sử dụng voucher</h2>
          {usage.isError ? (
            <Retry onRetry={() => void usage.refetch()} />
          ) : (
            usageList?.map((u) => (
              <p className="border-b py-4 text-sm" key={u.id}>
                {u.title} · Đã cam kết {u.committed}/{u.capacity} · Đang dùng/đã
                dùng {u.used}
              </p>
            ))
          )}
        </section>
      )}
      {admin && <PremiumOperations />}
    </main>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2 text-sm font-semibold">
      {label}
      <input {...props} className={premiumInput} />
    </label>
  );
}
