'use client';
import { useEffect, useState } from 'react';
import {
  usePremiumMutationMutation,
  usePremiumResourceQuery,
  type GuidePremiumProfile,
} from './api';
import { getApiErrorMessage } from '@/features/auth/utils/apiError';
import {
  uploadImageToCloudinary,
  validateImageFile,
} from '@/features/traveler-account/api/avatarUpload';
import type { ImageUploadSignature } from '@/features/traveler-account/types';
import { premiumButton, premiumInput, premiumMoney, Retry } from './ui';
import { GuidePremiumActivity } from './GuidePremiumActivity';

interface Analytics {
  byMonth: { month: string; amount: number; count: number }[];
  assignmentCounts: Record<string, number>;
  assignments: {
    tourId: string;
    status: string;
    respondedAt?: string;
    tour: { title: string };
  }[];
}
export function GuidePremiumEditor({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const profile = usePremiumResourceQuery('/premium/guide/profile');
  const analytics = usePremiumResourceQuery('/premium/guide/analytics', {
    skip: !active,
  });
  const [mutate, state] = usePremiumMutationMutation();
  const [data, setData] = useState<GuidePremiumProfile>({
    introduction: '',
    portfolio: [],
    certificates: [],
  });
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (profile.currentData && !dirty)
      setData(profile.currentData as GuidePremiumProfile);
  }, [profile.currentData, dirty, userId]);
  const update = (next: GuidePremiumProfile) => {
    setDirty(true);
    setData(next);
  };
  const upload = async (file: File, setUrl: (url: string) => void) => {
    const invalid = validateImageFile(file, 'Ảnh Premium');
    if (invalid) {
      setMessage(invalid);
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const signed = (await mutate({
        url: '/premium/guide/images/signature',
      }).unwrap()) as { data: { slot: string; upload: ImageUploadSignature } };
      const result = await uploadImageToCloudinary(file, signed.data.upload);
      const complete = (await mutate({
        url: '/premium/guide/images/complete',
        body: { slot: signed.data.slot, publicId: result.publicId },
      }).unwrap()) as { data: { secureUrl: string } };
      setUrl(complete.data.secureUrl);
    } catch (e) {
      setMessage(getApiErrorMessage(e, 'Không tải được ảnh.'));
    } finally {
      setUploading(false);
    }
  };
  const stats = analytics.currentData as Analytics | undefined;
  return (
    <section className="space-y-6 border-t border-slate-200 pt-8">
      <h2 className="text-xl font-bold">Hồ sơ chuyên nghiệp</h2>
      <p className="text-sm leading-6 text-slate-600">
        Giới thiệu, portfolio và chứng chỉ bổ sung sẽ hiển thị công khai trên hồ
        sơ Guide khi Premium đang hiệu lực.
      </p>
      {!active && (
        <p className="text-sm text-slate-600">
          Đăng ký Premium để chỉnh sửa và hiển thị hồ sơ nâng cao. Dữ liệu đã
          lưu được giữ nguyên khi hết hạn.
        </p>
      )}
      {profile.isError ? (
        <Retry onRetry={() => void profile.refetch()} />
      ) : profile.isLoading ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setMessage('');
            try {
              await mutate({
                url: '/premium/guide/profile',
                method: 'PUT',
                body: data,
              }).unwrap();
              setDirty(false);
              setMessage('Đã lưu hồ sơ Premium.');
            } catch (e) {
              setMessage(getApiErrorMessage(e, 'Không lưu được hồ sơ.'));
            }
          }}
        >
          <fieldset
            disabled={!active || state.isLoading || uploading}
            className="space-y-6 disabled:opacity-70"
          >
            <label className="block space-y-2 text-sm font-semibold">
              Giới thiệu chuyên môn
              <textarea
                className={premiumInput}
                maxLength={3000}
                rows={4}
                value={data.introduction}
                onChange={(e) =>
                  update({ ...data, introduction: e.target.value })
                }
              />
            </label>
            <div>
              <h3 className="font-semibold">Portfolio</h3>
              {data.portfolio.map((item, index) => (
                <div
                  key={index}
                  className="mt-4 grid gap-3 border-b border-slate-200 pb-5 sm:grid-cols-2"
                >
                  <label className="text-sm">
                    Tiêu đề
                    <input
                      required
                      maxLength={160}
                      className={premiumInput}
                      value={item.title}
                      onChange={(e) =>
                        update({
                          ...data,
                          portfolio: data.portfolio.map((x, i) =>
                            i === index ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Liên kết HTTPS
                    <input
                      type="url"
                      className={premiumInput}
                      value={item.url ?? ''}
                      onChange={(e) =>
                        update({
                          ...data,
                          portfolio: data.portfolio.map((x, i) =>
                            i === index
                              ? { ...x, url: e.target.value || undefined }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Mô tả
                    <textarea
                      className={premiumInput}
                      maxLength={1000}
                      value={item.description}
                      onChange={(e) =>
                        update({
                          ...data,
                          portfolio: data.portfolio.map((x, i) =>
                            i === index
                              ? { ...x, description: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Ảnh JPG/PNG/WebP, tối đa 5 MB
                    <input
                      className="mt-2 block w-full text-xs"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void upload(file, (url) =>
                            update({
                              ...data,
                              portfolio: data.portfolio.map((x, i) =>
                                i === index ? { ...x, imageUrl: url } : x,
                              ),
                            }),
                          );
                      }}
                    />
                  </label>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-28 max-w-full rounded-lg object-cover"
                    />
                  )}
                  <button
                    type="button"
                    className="text-left text-sm text-red-700 underline"
                    onClick={() =>
                      update({
                        ...data,
                        portfolio: data.portfolio.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Xóa mục portfolio
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={data.portfolio.length >= 20}
                className="mt-4 text-sm font-semibold text-teal-800 underline"
                onClick={() =>
                  update({
                    ...data,
                    portfolio: [
                      ...data.portfolio,
                      { title: '', description: '' },
                    ],
                  })
                }
              >
                Thêm portfolio
              </button>
            </div>
            <div>
              <h3 className="font-semibold">Chứng chỉ bổ sung</h3>
              <p className="mt-1 text-xs text-slate-600">
                Chứng chỉ do bạn cung cấp; nhãn Premium không xác nhận tính hợp
                lệ của chứng chỉ.
              </p>
              {data.certificates.map((item, index) => (
                <div
                  key={index}
                  className="mt-4 grid gap-3 border-b border-slate-200 pb-5 sm:grid-cols-2"
                >
                  {(['name', 'issuer', 'issuedAt'] as const).map((field) => (
                    <label key={field} className="text-sm">
                      {field === 'name'
                        ? 'Tên chứng chỉ'
                        : field === 'issuer'
                          ? 'Đơn vị cấp'
                          : 'Ngày cấp'}
                      <input
                        required
                        type={field === 'issuedAt' ? 'date' : 'text'}
                        maxLength={160}
                        className={premiumInput}
                        value={item[field]}
                        onChange={(e) =>
                          update({
                            ...data,
                            certificates: data.certificates.map((x, i) =>
                              i === index
                                ? { ...x, [field]: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="text-sm">
                    Ảnh chứng chỉ
                    <input
                      className="mt-2 block w-full text-xs"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void upload(file, (url) =>
                            update({
                              ...data,
                              certificates: data.certificates.map((x, i) =>
                                i === index ? { ...x, documentUrl: url } : x,
                              ),
                            }),
                          );
                      }}
                    />
                  </label>
                  {item.documentUrl && (
                    <a
                      href={item.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-teal-800 underline"
                    >
                      Xem chứng chỉ
                    </a>
                  )}
                  <button
                    type="button"
                    className="text-left text-sm text-red-700 underline"
                    onClick={() =>
                      update({
                        ...data,
                        certificates: data.certificates.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    Xóa chứng chỉ
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={data.certificates.length >= 20}
                className="mt-4 text-sm font-semibold text-teal-800 underline"
                onClick={() =>
                  update({
                    ...data,
                    certificates: [
                      ...data.certificates,
                      { name: '', issuer: '', issuedAt: '' },
                    ],
                  })
                }
              >
                Thêm chứng chỉ
              </button>
            </div>
            <button className={premiumButton}>
              {uploading
                ? 'Đang tải ảnh…'
                : state.isLoading
                  ? 'Đang lưu…'
                  : 'Lưu hồ sơ Premium'}
            </button>
          </fieldset>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm text-teal-800">
          {message}
        </p>
      )}
      {active && (
        <section className="space-y-4 border-t border-slate-200 pt-6">
          <h2 className="text-xl font-bold">Thống kê nâng cao</h2>
          {analytics.isError ? (
            <Retry onRetry={() => void analytics.refetch()} />
          ) : !stats ? (
            <p role="status">Đang tải thống kê…</p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Thu nhập ghi nhận, chưa phản ánh tiền đã chuyển. Tháng thống kê
                theo UTC.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3">Tháng</th>
                      <th>Booking hoàn tất</th>
                      <th>Thu nhập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byMonth.map((row) => (
                      <tr key={row.month} className="border-b">
                        <td className="py-3">{row.month}</td>
                        <td>{row.count}</td>
                        <td>{premiumMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!stats.byMonth.length && (
                  <p className="py-4 text-sm text-slate-600">
                    Chưa có thu nhập ghi nhận.
                  </p>
                )}
              </div>
              <h3 className="font-semibold">Phân công hiện tại</h3>
              <p className="text-sm text-slate-600">
                {Object.entries(stats.assignmentCounts)
                  .map(
                    ([key, count]) =>
                      `${key === 'ACCEPTED' ? 'Đã nhận' : key === 'DECLINED' ? 'Đã từ chối' : 'Chờ phản hồi'}: ${count}`,
                  )
                  .join(' · ') || 'Chưa có phân công'}
              </p>
              {stats.assignments.map((a) => (
                <p key={a.tourId} className="border-b py-3 text-sm">
                  {a.tour.title} ·{' '}
                  {a.status === 'ACCEPTED'
                    ? 'Đã nhận'
                    : a.status === 'DECLINED'
                      ? 'Đã từ chối'
                      : 'Chờ phản hồi'}
                  {a.respondedAt &&
                    ` · ${new Date(a.respondedAt).toLocaleDateString('vi-VN')}`}
                </p>
              ))}
            </>
          )}
        </section>
      )}
      {active && <GuidePremiumActivity />}
    </section>
  );
}
