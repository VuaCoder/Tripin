/** S7 acceptance in a real browser: the request travels tour detail -> chat -> both lists -> agency decision.
 * Three processes, in this order:
 *   backend: CLIENT_URL=http://localhost:3002 node_modules/.bin/tsx src/test/chat-browser-server.ts
 *   frontend: NEXT_PUBLIC_API_URL=http://localhost:3003/api/v1 node_modules/.bin/next dev -p 3002
 *   backend: PLAYWRIGHT_MODULE=<path to playwright> node src/test/custom-tours.browser-smoke.cjs
 * Screenshots and result.json land in plan/docs/screenshots/s7/. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = 'http://localhost:3002';
const api = 'http://localhost:3003/api/v1';
const output = path.resolve(__dirname, '../../../plan/docs/screenshots/s7');
fs.mkdirSync(output, { recursive: true });

const PASSWORD = process.env.CHAT_SMOKE_PASSWORD;
// Unique per run: the disposable database keeps earlier requests between runs.
const NOTE = `Đoàn công ty 6 người, muốn khởi hành cuối tuần và cần xe đưa đón. Mã ${Date.now()}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const checks = [];
  const shots = [];
  const snap = async (page, name) => {
    await page.screenshot({ path: path.join(output, name) });
    shots.push(name);
  };
  const traveler = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  traveler.setDefaultTimeout(30000);
  const page = await traveler.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const agency = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  agency.setDefaultTimeout(30000);
  const agencyPage = await agency.newPage();
  agencyPage.on('pageerror', (error) => errors.push(error.message));

  try {
    const tours = await (await traveler.request.get(`${api}/tours`)).json();
    const tour = tours.data[0];
    assert.ok(tour?.id, 'fixture seeded at least one public tour');

    // 1. Traveler sends a group request from the tour page.
    await page.goto(`${base}/login`);
    await page.locator('#user-credential').fill('traveler@chat.test');
    await page.locator('#user-password').fill(PASSWORD);
    await page.locator('form[data-purpose="login-form"] button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'));
    await page.goto(`${base}/tours/${tour.id}`);
    await page.getByRole('heading', { name: tour.title, exact: true }).waitFor();
    const requestButton = page.getByRole('button', { name: 'Yêu cầu booking đoàn', exact: true });
    await requestButton.scrollIntoViewIfNeeded();
    await snap(page, '01-tour-cta.png');

    await requestButton.click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const note = dialog.getByLabel('Ghi chú', { exact: false });
    const startDateInput = dialog.getByLabel('Ngày khởi hành dự kiến', { exact: true });
    // Opens on the departure already selected on the tour page, and can be changed.
    assert.match(await startDateInput.inputValue(), /^\d{4}-\d{2}-\d{2}$/);
    const startDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    await startDateInput.fill(startDate);
    const adults = dialog.getByRole('spinbutton', { name: 'Người lớn', exact: true });

    // The dialog opens with the counts from the tour page (one adult), lifted to the 2-person floor.
    assert.equal(await adults.inputValue(), '2');

    // Client-side guard: one person is below the 2-person floor and must not submit.
    await dialog.getByRole('button', { name: 'Giảm người lớn', exact: true }).click();
    await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 1, 'dialog stays open for an invalid group size');
    assert.match(await dialog.innerText(), /Đoàn phải từ 2 đến 50 người/);
    checks.push('Dialog blocks a group below the 2-person floor');

    // Adults and children follow the tour's own age pricing; the head count is their sum.
    // Back from 1 adult to 3, then 3 children: the 6-person group the request is asserted on.
    for (let step = 0; step < 2; step++) await dialog.getByRole('button', { name: 'Tăng người lớn', exact: true }).click();
    for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: 'Tăng trẻ em', exact: true }).click();
    assert.equal(await adults.inputValue(), '3');
    assert.match(await dialog.innerText(), /Tổng 6 người/);
    await note.fill(NOTE);
    await snap(page, '02-request-dialog.png');
    const created = page.waitForResponse(
      (response) => response.url() === `${api}/custom-tours` && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
    const createdResponse = await created;
    assert.equal(createdResponse.status(), 201);
    const request = (await createdResponse.json()).data;
    assert.equal(request.status, 'SUBMITTED');
    assert.equal(request.participants, 6);
    assert.deepEqual(request.guestCounts, { adults: 3, children: 3, infants: 0 });
    assert.equal(request.startDate.slice(0, 10), startDate);
    assert.ok(request.conversationId, 'server opened a conversation for the request');
    await page.waitForURL((url) => url.pathname === `/conversations/${request.conversationId}`);
    assert.match(page.url(), new RegExp(`request=${request.id}`));
    // Wait for the thread to replace its skeletons, not the routing transition.
    await page.getByPlaceholder('Nhập tin nhắn…').waitFor();
    await snap(page, '03-traveler-conversation.png');
    checks.push('Request from the tour page opens its conversation with ?request=<id>');

    // 2. Traveler list shows it and offers the chat step.
    await page.goto(`${base}/traveler/custom-tours`);
    await page.getByRole('heading', { name: 'Yêu cầu đoàn của tôi', exact: true }).waitFor();
    const travelerCard = page.locator('li').filter({ hasText: NOTE }).filter({ hasText: 'Chờ đại lý phản hồi' }).first();
    await travelerCard.waitFor();
    assert.match(await travelerCard.innerText(), /6 người · 3 người lớn, 3 trẻ em/);
    assert.match(await travelerCard.innerText(), /Khởi hành dự kiến/);
    await snap(page, '04-traveler-requests.png');
    checks.push('Traveler list renders the request with status and member count');

    // 3. Agency sees it and accepts it from the list.
    await agencyPage.goto(`${base}/agency/login`);
    await agencyPage.locator('input[type="email"]').fill('agency@chat.test');
    await agencyPage.locator('input[type="password"]').fill(PASSWORD);
    await agencyPage.locator('button[type="submit"]').click();
    await agencyPage.waitForURL((url) => url.pathname === '/agency');
    await agencyPage.goto(`${base}/agency/custom-tours`);
    await agencyPage.getByRole('heading', { name: 'Yêu cầu đoàn', exact: true }).waitFor();
    const agencyCard = agencyPage.locator('li').filter({ hasText: NOTE }).first();
    await agencyCard.waitFor();
    assert.match(await agencyCard.innerText(), /6 người · 3 người lớn, 3 trẻ em/);
    await snap(agencyPage, '05-agency-requests.png');

    const decided = agencyPage.waitForResponse(
      (response) => response.url() === `${api}/custom-tours/${request.id}/decision` && response.request().method() === 'PATCH',
    );
    await agencyCard.getByRole('button', { name: 'Nhận', exact: true }).click();
    assert.equal((await decided).status(), 200);
    await agencyCard.getByText('Đang thương lượng', { exact: false }).waitFor();
    await snap(agencyPage, '06-agency-accepted.png');
    checks.push('Agency accepts from the list and the card moves to negotiating');

    // 4. Traveler sees the new status and can re-enter the conversation.
    await page.goto(`${base}/traveler/custom-tours`);
    const negotiating = page.locator('li').filter({ hasText: NOTE }).filter({ hasText: 'Đang thương lượng' }).first();
    await negotiating.waitFor();
    const chatLink = negotiating.getByRole('link', { name: 'Mở chat', exact: true });
    assert.match(await chatLink.getAttribute('href'), new RegExp(`/conversations/${request.conversationId}\\?request=${request.id}`));
    await snap(page, '07-traveler-negotiating.png');
    checks.push('Traveler sees the agency decision and the chat link keeps the request id');

    // 5. Mobile layout without horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('heading', { name: 'Yêu cầu đoàn của tôi', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'no horizontal overflow on mobile',
    );
    await snap(page, '08-mobile-requests.png');
    checks.push('Mobile list has no horizontal overflow');

    assert.deepEqual(errors, []);
    const report = { passed: true, checks, shots, errors, requestId: request.id, conversationId: request.conversationId };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, output }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure-traveler.png'), fullPage: true }).catch(() => {});
    await agencyPage.screenshot({ path: path.join(output, 'failure-agency.png'), fullPage: true }).catch(() => {});
    console.log('--- traveler body ---');
    console.log((await page.locator('body').innerText().catch(() => '')).slice(-2500));
    console.log('--- agency body ---');
    console.log((await agencyPage.locator('body').innerText().catch(() => '')).slice(-2500));
    console.log('--- page errors ---');
    console.log(errors);
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
