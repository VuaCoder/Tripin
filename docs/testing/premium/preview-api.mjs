// Read-only visual-QA fixture. Never connects to a database or payment provider.
// Run with Node, then NEXT_PUBLIC_API_URL=http://127.0.0.1:32992/api/v1 next dev -p 32991.
import http from 'node:http';
const port = 32992;
let role = 'TRAVELER';
const id = '11111111-1111-4111-8111-111111111111';
const tourId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';
const sourceId = '44444444-4444-4444-8444-444444444444';
const endsAt = '2026-11-25T16:59:59.000Z';
const profile = {
  introduction: 'Đồng hành cùng du khách khám phá văn hóa và ẩm thực Việt Nam.',
  portfolio: [
    {
      title: 'Hành trình di sản miền Trung',
      description: 'Trải nghiệm Huế, Hội An và những câu chuyện bản địa.',
    },
  ],
  certificates: [
    {
      name: 'Sơ cứu du lịch',
      issuer: 'Đơn vị đào tạo mẫu',
      issuedAt: '2026-01-01',
    },
  ],
};
const terms = {
  title: 'Ưu đãi hành trình di sản',
  agencyId: id,
  tourIds: [tourId],
  discountType: 'PERCENT',
  discountValue: 10,
  maxDiscountAmount: 100000,
  minOrderAmount: 500000,
};
const contribution = {
  ...terms,
  id: sourceId,
  capacity: 100,
  reserved: 12,
  status: 'APPROVED',
  acceptingNew: true,
};
const user = () => ({
  id,
  email: 'preview@example.invalid',
  fullName: 'Nguyễn An (Demo)',
  role,
  status: 'ACTIVE',
  permissions: [
    'profile:view-own',
    'profile:update-own',
    'premium:subscribe',
    'premium:contribute',
    'premium:manage',
    'guide:tours-view',
    'guide:tours-verify',
    'earnings:view',
    'subscription:subscribe',
    'tour:assign-guide',
    'promotion:agency-manage',
    'tour:update-own',
    'agency:dashboard',
    'agency:bookings-view',
  ],
  extraPermissions: [],
  twoFactorEnabled: false,
  emailVerifiedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  guideProfile: {
    bio: 'Hướng dẫn viên địa phương',
    languages: ['Tiếng Việt', 'English'],
    specialties: ['Văn hóa', 'Ẩm thực'],
    experienceYears: 5,
  },
  agencyProfile: { companyName: 'Tripri Demo', verificationStatus: 'VERIFIED' },
});
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):32991$/.test(origin))
    res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/preview/role/')) {
    const next = pathname.split('/').at(-1);
    if (['TRAVELER', 'TOUR_GUIDE', 'AGENCY', 'SUPER_ADMIN'].includes(next))
      role = next;
    res.end(JSON.stringify({ role }));
    return;
  }
  if (req.method !== 'GET' && pathname !== '/api/v1/auth/refresh') {
    res.writeHead(405);
    res.end(
      JSON.stringify({
        success: false,
        error: { message: 'Visual preview is read-only' },
      }),
    );
    return;
  }
  let data = [];
  const p = pathname.replace('/api/v1', '');
  if (p === '/auth/refresh')
    data = { accessToken: 'visual-preview-only', user: user() };
  else if (p === '/users/me') data = user();
  else if (p === '/premium/me') data = { active: true, endsAt, expired: false };
  else if (p === '/premium/plans')
    data = [
      {
        id: planId,
        code: 'PREVIEW_ONLY',
        name: 'Premium 30 ngày',
        description: 'Dữ liệu mẫu chỉ dùng kiểm tra giao diện.',
        audience: role,
        version: 1,
        price: 99000,
        durationDays: 30,
        benefits:
          role === 'TOUR_GUIDE'
            ? [
                'Hồ sơ chuyên nghiệp và portfolio',
                'Ưu tiên hiển thị trước Agency',
                'Thống kê thu nhập nâng cao',
              ]
            : [
                'Bộ voucher riêng trong mỗi kỳ',
                'Ưu đãi từ các Agency đồng hành',
              ],
        vouchers: role === 'TRAVELER' ? [{ ...terms, quantity: 2 }] : [],
      },
    ];
  else if (p === '/premium/me/history')
    data = [
      {
        id: planId,
        planName: 'Premium 30 ngày',
        price: 99000,
        status: 'ACTIVE',
        startsAt: '2026-10-25T00:00:00Z',
        endsAt,
        revokedAt: null,
        premiumRefund: null,
      },
    ];
  else if (p === '/premium/me/vouchers')
    data = [
      {
        id: sourceId,
        terms,
        startsAt: '2026-10-25T00:00:00Z',
        endsAt,
        heldAt: null,
        bookingId: null,
      },
    ];
  else if (p === '/premium/guide/profile') data = profile;
  else if (p === '/premium/guide/analytics')
    data = {
      byMonth: [
        { month: '2026-09', amount: 1200000, count: 4 },
        { month: '2026-10', amount: 1800000, count: 6 },
      ],
      assignments: [],
      assignmentCounts: { ACCEPTED: 3, PENDING: 1 },
      activity: [
        {
          id: sourceId,
          action: 'ACCEPTED',
          tourTitle: 'Hành trình di sản miền Trung',
          occurredAt: '2026-10-25T01:00:00Z',
        },
      ],
    };
  else if (p.startsWith('/premium/guides/')) data = { active: true, profile };
  else if (p === '/admin/premium/plans')
    data = [
      {
        id: planId,
        name: 'Premium Traveler',
        price: 99000,
        durationDays: 30,
        version: 1,
        audience: 'TRAVELER',
        published: true,
      },
    ];
  else if (p.endsWith('/premium/contributions')) data = [contribution];
  else if (p === '/admin/premium/flags')
    data = [
      { key: 'premium.enabled.TRAVELER', value: true },
      { key: 'premium.enabled.TOUR_GUIDE', value: true },
    ];
  else if (p === '/admin/premium/refunds') data = [];
  else if (p === '/admin/premium/operations')
    data = { unfulfilled: [], overdueHolds: 0, pendingRefunds: 0 };
  else if (p === '/agency/premium/usage')
    data = [
      {
        id: sourceId,
        title: terms.title,
        capacity: 100,
        committed: 12,
        used: 3,
      },
    ];
  else if (p === '/agency/tours')
    data = [{ id: tourId, title: 'Hành trình di sản miền Trung' }];
  else if (p === '/notifications/unread-count') data = { count: 0 };
  else if (p.startsWith('/tour-guides/'))
    data = {
      id,
      fullName: 'Nguyễn An (Demo)',
      bio: 'Hướng dẫn viên địa phương',
      languages: ['Tiếng Việt'],
      specialties: ['Văn hóa'],
      experienceYears: 5,
    };
  res.end(
    JSON.stringify({
      success: true,
      data,
      meta: {
        page: 1,
        limit: 20,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: 1,
      },
    }),
  );
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Read-only Premium preview API: http://127.0.0.1:${port}`),
);
