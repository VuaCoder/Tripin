/**
 * Playwright run for the Tour-guide "nhận tour được phân công" flow, the web counterpart of the
 * mobile Lịch Tour screen, plus the API contract that screen and the passenger roster depend on.
 * No network mocks: real Chromium, real backend, real Postgres.
 *
 *   DEV_GUIDE_PASSWORD=... node docs/testing/guide-tours/verify-guide-tours.mjs
 *
 * Local stack (see docs/testing/guide-check-in/README.md) and fixtures:
 *   backend/src/scripts/dev-guide-fixture.ts create
 *   backend/src/scripts/dev-guide-check-in-fixture.ts create
 *
 * The driver answers the single PENDING assignment, so recreate the fixtures before every run.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium, request } = require(
  process.env.PLAYWRIGHT_MODULE ??
    '/home/duckneo/.local/share/mise/installs/node/22.23.2/lib/node_modules/@playwright/cli/node_modules/playwright-core',
);

const BASE = 'http://localhost:3100';
const ORIGIN = 'http://localhost:3001';
const OUT = 'docs/testing/guide-tours';

const GUIDE = 'dev.guide@tripri.test';
const FOREIGN_GUIDE = 'dev.guide.foreign@tripri.test';
const TRAVELER = 'dev.guide.traveler@tripri.test';
const PASSWORD = process.env.DEV_GUIDE_PASSWORD;
if (!PASSWORD) throw new Error('DEV_GUIDE_PASSWORD is required');

const PENDING_TITLE = '[DEV-GUIDE] Hạ Long 2N1Đ';
const ACCEPTED_TITLE = '[DEV-GUIDE] Đà Nẵng – Hội An 3N2Đ';
const DECLINED_TITLE = '[DEV-GUIDE] Phú Quốc 4N3Đ';

mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const calls = [];
const pageErrors = [];

const api = await request.newContext({ baseURL: ORIGIN });
const loginApi = async (email) => {
  const response = await api.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  const body = await response.json().catch(() => null);
  return { status: response.status(), token: body?.data?.accessToken };
};
const call = async (method, path, token, data) => {
  const response = await api.fetch(`/api/v1${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(data === undefined ? {} : { data }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status(), body, error: body?.error };
};

// ---------------------------------------------------------------- 1. guest is sent to login
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (!response.url().includes('/api/v1/')) return;
  const parsed = new URL(response.url());
  calls.push({ method: response.request().method(), path: `${parsed.pathname}${parsed.search}`, status: response.status() });
});

const shot = async (name, { fullPage = true } = {}) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`  [shot] ${OUT}/${name}.png`);
};
const visible = async (locator, timeout = 30000) => {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
};
const waitForCount = async (locator, count, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await locator.count()) === count) return true;
    await page.waitForTimeout(200);
  }
  return false;
};
const loginUi = async (email) => {
  await context.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500); // controlled inputs drop values typed before hydration
  await page.fill('#user-credential', email);
  await page.fill('#user-password', PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
};

await page.goto(`${BASE}/guide/tours`, { waitUntil: 'domcontentloaded' });
await page.waitForURL('**/login**', { timeout: 30000 });
check('khách chưa đăng nhập vào /guide/tours bị đẩy về /login', page.url().includes('/login'));
await shot('01-guide-tours-requires-login', { fullPage: false });

// ---------------------------------------------------------------- 2. the assignment list
await loginUi(GUIDE);
check('đăng nhập HDV thành công', page.url().endsWith('/guide'), page.url());
await page.goto(`${BASE}/guide/tours`, { waitUntil: 'domcontentloaded' });
check('tiêu đề "Tour nhận dẫn" hiển thị', await visible(page.getByRole('heading', { name: 'Tour nhận dẫn' })));
check(
  'đủ 4 tour: 1 chờ xác nhận, 2 đã nhận, 1 đã từ chối',
  (await waitForCount(page.getByText('Chờ bạn xác nhận', { exact: true }), 1)) &&
    (await waitForCount(page.getByText('Đã nhận tour', { exact: true }), 2)) &&
    (await waitForCount(page.getByText('Đã từ chối', { exact: true }), 1)),
);
check('GET /guide/tours trả 200', calls.some((c) => c.method === 'GET' && c.path.startsWith('/api/v1/guide/tours') && c.status === 200));
check('tour PENDING hiển thị', await visible(page.getByText(PENDING_TITLE)));
check('tour ACCEPTED và DECLINED hiển thị', (await visible(page.getByText(ACCEPTED_TITLE))) && (await visible(page.getByText(DECLINED_TITLE))));
check(
  'chỉ tour PENDING có nút xác nhận (1 nhận / 1 từ chối)',
  (await page.getByRole('button', { name: /Nhận tour/ }).count()) === 1 &&
    (await page.getByRole('button', { name: 'Từ chối' }).count()) === 1,
);
check('thù lao mỗi booking đọc từ backend', await visible(page.getByText(/500\.000/)));
check('tour của HDV khác không xuất hiện', (await page.getByText('Sapa').count()) === 0);
await shot('02-guide-tours-list');

// ---------------------------------------------------------------- 3. accept through the dialog
await page.getByRole('button', { name: /Nhận tour/ }).click();
check('hộp thoại nhận tour mở ra', await visible(page.getByRole('dialog')));
await page.getByLabel(/Ghi chú/).fill('Đã sắp xếp lịch, xác nhận qua Playwright.');
await shot('03-accept-dialog', { fullPage: false });
await page.getByRole('button', { name: 'Xác nhận nhận tour' }).click();
check('có thông báo nhận tour thành công', await visible(page.getByText('Bạn đã nhận tour thành công.')));
const verification = calls.filter((c) => c.path.includes('/verification')).at(-1);
check('POST /guide/tours/:tourId/verification trả 200', verification?.status === 200, JSON.stringify(verification));
check(
  'badge đổi sang "Đã nhận tour" ngay sau khi trả lời (3 tour)',
  await waitForCount(page.getByText('Đã nhận tour', { exact: true }), 3),
);
check('không còn tour chờ xác nhận và không còn nút xác nhận', (await waitForCount(page.getByText('Chờ bạn xác nhận', { exact: true }), 0)) && (await page.getByRole('button', { name: /Nhận tour/ }).count()) === 0);
await shot('04-accepted');

// ---------------------------------------------------------------- 4. the answer survives a reload
await page.reload({ waitUntil: 'domcontentloaded' });
check('sau reload vẫn 3 tour đã nhận (đã ghi vào DB)', await waitForCount(page.getByText('Đã nhận tour', { exact: true }), 3));
check('sau reload không còn nút xác nhận', (await page.getByRole('button', { name: /Nhận tour/ }).count()) === 0);
await shot('05-accepted-after-reload');

// ---------------------------------------------------------------- 5. a TRAVELER cannot enter
await loginUi(TRAVELER);
await page.goto(`${BASE}/guide/tours`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !location.pathname.startsWith('/guide'), null, { timeout: 25000 }).catch(() => {});
check('Traveler vào /guide/tours bị đẩy khỏi khu vực HDV', !page.url().includes('/guide'), page.url());
await shot('06-role-guard-traveler', { fullPage: false });

// ---------------------------------------------------------------- 6. API contract behind the mobile screen
const guideLogin = await loginApi(GUIDE);
const travelerLogin = await loginApi(TRAVELER);
const foreignLogin = await loginApi(FOREIGN_GUIDE);
check('đăng nhập API cho HDV / traveler / HDV khác', Boolean(guideLogin.token && travelerLogin.token && foreignLogin.token));

const tours = await call('GET', '/guide/tours?page=1&limit=10', guideLogin.token);
const items = tours.body?.data ?? [];
const byTitle = (title) => items.find((item) => item.title === title);
const accepted = byTitle(ACCEPTED_TITLE);
check('sau khi trả lời: 3 ACCEPTED, 1 DECLINED, 0 PENDING', tours.status === 200 && items.filter((i) => i.assignment.status === 'ACCEPTED').length === 3 && items.filter((i) => i.assignment.status === 'DECLINED').length === 1 && !items.some((i) => i.assignment.status === 'PENDING'));
check('assignment mang thù lao + mốc phản hồi', typeof accepted?.assignment?.feePerBooking === 'number' && Boolean(accepted?.assignment?.respondedAt));
check('mỗi tour có nextDepartureDate để tính "Lịch sắp tới"', items.every((item) => Boolean(item.nextDepartureDate)));

const detail = await call('GET', `/tours/${accepted.id}`, undefined);
const departure = detail.body?.data?.departures?.find(
  (d) => new Date(d.date).toDateString() === new Date(accepted.nextDepartureDate).toDateString(),
);
check('GET /tours/:id trả 200 cho tour đã nhận', detail.status === 200);
check(
  'chi tiết có mô tả, quy mô và chuyến khớp ngày khởi hành',
  typeof detail.body?.data?.description === 'string' &&
    typeof detail.body?.data?.maxGroupSize === 'number' &&
    Boolean(departure) &&
    departure.capacity - departure.remaining === 6,
  JSON.stringify({ maxGroupSize: detail.body?.data?.maxGroupSize, booked: departure && departure.capacity - departure.remaining }),
);

const roster = await call('GET', `/guide/e-tickets/${accepted.id}`, guideLogin.token);
const rosterData = roster.body?.data;
const byBooking = (code) => rosterData?.items?.find((item) => item.bookingCode === code);
const guestCounts = ({ adults, children, infants } = {}) => `${adults}/${children}/${infants}`;
check('GET roster trả 200, đúng tour, 3 vé và 1 đã có mặt', roster.status === 200 && rosterData.tourTitle === ACCEPTED_TITLE && rosterData.total === 3 && rosterData.checkedIn === 1);
check(
  'hành khách có SĐT khẩn cấp và số người lớn/trẻ em',
  byBooking('DEVCHK-0001')?.contactPhone === '0900000000' && guestCounts(byBooking('DEVCHK-0001')?.guests) === '1/1/0',
  guestCounts(byBooking('DEVCHK-0001')?.guests),
);
check('ghi chú hành khách được trả về', byBooking('DEVCHK-0001')?.notes === 'Dị ứng hải sản, cần phòng riêng.');
check(
  'booking thiếu giá theo tuổi fallback toàn bộ là người lớn',
  guestCounts(byBooking('DEVCHK-0002')?.guests) === '1/0/0',
);
check('vé đã dùng tính là đã lên xe, có checkedInAt', byBooking('DEVCHK-0005')?.checkedIn === true && Boolean(byBooking('DEVCHK-0005')?.checkedInAt));
check('roster không làm lộ mã vé', rosterData.items.every((item) => !('code' in item)));

check('Traveler gọi GET /guide/tours bị chặn 403', (await call('GET', '/guide/tours', travelerLogin.token)).status === 403);
check('Khách chưa đăng nhập gọi GET /guide/tours bị chặn 401', (await call('GET', '/guide/tours')).status === 401);
check('Traveler gọi roster của HDV bị chặn 403', (await call('GET', `/guide/e-tickets/${accepted.id}`, travelerLogin.token)).status === 403);
check('HDV khác đọc roster tour không thuộc quyền → 404', (await call('GET', `/guide/e-tickets/${accepted.id}`, foreignLogin.token)).status === 404);
const duplicate = await call('POST', `/guide/tours/${accepted.id}/verification`, guideLogin.token, { accept: true });
check('trả lời lại tour đã xử lý → 409 INVALID_STATE_TRANSITION', duplicate.status === 409 && duplicate.error?.code === 'INVALID_STATE_TRANSITION');

await browser.close();
await api.dispose();

console.log('\nRequest thật tới backend:');
for (const call of calls) console.log(`  ${call.method} ${call.path} -> ${call.status}`);

const failed = results.filter((result) => !result.ok);
console.log(`\nPage errors: ${pageErrors.length}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
