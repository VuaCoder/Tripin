import type { GuidePremiumProfile } from './api';
const safe = (url?: string) => {
  try {
    return url && new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};
export function PublicPremiumPortfolio({
  profile,
}: {
  profile: GuidePremiumProfile;
}) {
  return (
    <section className="mt-10 space-y-7 border-t border-slate-200 pt-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Chuyên môn nổi bật{' '}
          <span className="ml-2 text-sm text-amber-800">Premium</span>
        </h2>
        <p className="mt-4 max-w-prose whitespace-pre-line text-slate-700">
          {profile.introduction}
        </p>
      </div>
      {profile.portfolio.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {profile.portfolio.map((p, i) => (
            <article key={i}>
              {safe(p.imageUrl) && (
                <img
                  src={safe(p.imageUrl)}
                  alt={p.title}
                  loading="lazy"
                  className="mb-3 aspect-video w-full rounded-xl object-cover"
                />
              )}
              <h3 className="font-bold">{p.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                {p.description}
              </p>
              {safe(p.url) && (
                <a
                  className="mt-2 inline-block text-sm font-semibold text-teal-800 underline"
                  href={safe(p.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xem portfolio
                </a>
              )}
            </article>
          ))}
        </div>
      )}
      {profile.certificates.length > 0 && (
        <div>
          <h3 className="font-bold">Chứng chỉ bổ sung</h3>
          <p className="mt-2 text-xs text-slate-600">
            Do hướng dẫn viên cung cấp. Premium là trạng thái hội viên, không
            phải xác minh chứng chỉ.
          </p>
          {profile.certificates.map((c, i) => (
            <div key={i} className="border-b py-4 text-sm">
              <p className="font-semibold">{c.name}</p>
              <p className="mt-1 text-slate-600">
                {c.issuer} · {c.issuedAt}
              </p>
              {safe(c.documentUrl) && (
                <a
                  href={safe(c.documentUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-teal-800 underline"
                >
                  Xem chứng chỉ
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
