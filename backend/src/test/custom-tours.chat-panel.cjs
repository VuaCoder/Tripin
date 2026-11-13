/**
 * S8 acceptance in a real browser: the pinned group-request card opens a centred dialog over the chat,
 * the agency edits the negotiated tour details and sends the offer, the traveler reads those details
 * next to the price and accepts — all inside the conversation. Then S9: the traveler fills the passenger
 * form, it autosaves, and a reload restores exactly what was saved. S10: the same form becomes a booking and
 * opens its detail page, where PayOS is offered and the named members are listed. S11: leaving the flow and coming
 * back — the request list and the pinned card both resume the same booking instead of the passenger form. S12: the
 * same screens at 320/768/1024/1440px with the keyboard, and the dialog's focus trap.
 * Three processes, in this order:
 *   backend: CLIENT_URL=http://localhost:3002 node_modules/.bin/tsx src/test/chat-browser-server.ts
 *   frontend: NEXT_PUBLIC_API_URL=http://localhost:3003/api/v1 node_modules/.bin/next dev -p 3002
 *   backend: PLAYWRIGHT_MODULE=<path to playwright> node src/test/custom-tours.chat-panel.cjs
 * Screenshots and result.json land in plan/docs/screenshots/{s8,s9,s10,s12}/ (all four folders are rebuilt on every run).
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = 'http://localhost:3002';
const api = 'http://localhost:3003/api/v1';
const output = path.resolve(__dirname, '../../../plan/docs/screenshots/s8');
const checkoutOutput = path.resolve(__dirname, '../../../plan/docs/screenshots/s9');
const bookingOutput = path.resolve(__dirname, '../../../plan/docs/screenshots/s10');
const reviewOutput = path.resolve(__dirname, '../../../plan/docs/screenshots/s12');
for (const folder of [output, checkoutOutput, bookingOutput, reviewOutput]) {
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
}

const PASSWORD = process.env.CHAT_SMOKE_PASSWORD;
const contextOptions = { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const checks = [];
  const shots = [];
  const snap = async (page, name) => {
    await page.screenshot({ path: path.join(output, name) });
    shots.push(name);
  };
  const shots9 = [];
  const snap9 = async (page, name) => {
    await page.screenshot({ path: path.join(checkoutOutput, name) });
    shots9.push(name);
  };
  const shots10 = [];
  const snap10 = async (page, name, options = {}) => {
    await page.screenshot({ path: path.join(bookingOutput, name), ...options });
    shots10.push(name);
  };
  const login = async (page, email) => {
    await page.goto(`${base}/login`);
    await page.locator('#user-credential').fill(email);
    await page.locator('#user-password').fill(PASSWORD);
    await page.locator('form[data-purpose="login-form"] button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'));
  };
  // The agency has its own sign-in screen and lands on its dashboard.
  const agencyLogin = async (page) => {
    await page.goto(`${base}/agency/login`);
    await page.locator('input[type="email"]').fill('agency@chat.test');
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === '/agency');
  };

  const travelerContext = await browser.newContext(contextOptions);
  travelerContext.setDefaultTimeout(30000);
  const traveler = await travelerContext.newPage();
  traveler.on('pageerror', (error) => errors.push(`traveler: ${error.message}`));
  const agencyContext = await browser.newContext(contextOptions);
  agencyContext.setDefaultTimeout(30000);
  const agency = await agencyContext.newPage();
  agency.on('pageerror', (error) => errors.push(`agency: ${error.message}`));

  try {
    const tours = await (await traveler.request.get(`${api}/tours`)).json();
    const tour = tours.data[0];
    assert.ok(tour?.id, 'fixture seeded at least one public tour');

    // 1. Traveler sends a group request from the tour page and lands in its conversation.
    await login(traveler, 'traveler@chat.test');
    await traveler.goto(`${base}/tours/${tour.id}`);
    await traveler.getByRole('button', { name: 'Yêu cầu booking đoàn', exact: true }).click();
    const dialog = traveler.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
    await traveler.waitForURL((url) => url.pathname.startsWith('/conversations/'));
    const conversationUrl = traveler.url();
    const requestId = new URL(conversationUrl).searchParams.get('request');
    assert.ok(requestId, 'the request id is in the conversation deep link');

    const travelerPin = traveler.getByRole('button', { name: /Xem thỏa thuận/ });
    await travelerPin.waitFor();
    assert.match(await traveler.locator('body').innerText(), /Booking đoàn/);
    assert.match(await traveler.locator('body').innerText(), /Chờ đại lý phản hồi/);
    checks.push('Traveler sees the pinned group-request card in the new conversation');
    await snap(traveler, '01-traveler-pin-card.png');

    // 2. Agency accepts the request inside the chat panel and edits the private tour.
    await agencyLogin(agency);
    await agency.goto(conversationUrl);
    const agencyPin = agency.getByRole('button', { name: /Xem thỏa thuận/ });
    await agencyPin.waitFor();
    await agencyPin.click();
    const panel = agency.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' });
    await panel.waitFor();
    assert.match(await panel.innerText(), /Chờ đại lý phản hồi/);
    // A centred dialog over a dimmed page.
    const viewportWidth = await agency.evaluate(() => document.documentElement.clientWidth);
    const viewportHeight = await agency.evaluate(() => document.documentElement.clientHeight);
    const panelBox = await panel.boundingBox();
    assert.ok(Math.abs((panelBox?.width ?? 0) - 896) <= 1, `the dialog is 896px wide (${panelBox?.width})`);
    assert.ok(Math.abs((panelBox?.x ?? 0) - (viewportWidth - (panelBox?.width ?? 0)) / 2) <= 1, 'the dialog is centred horizontally');
    assert.ok((panelBox?.height ?? 0) <= viewportHeight * 0.9 + 1, 'the dialog leaves the page visible above and below');
    assert.ok(await panel.evaluate((element) => element.matches(':modal')), 'the dialog is in the modal top layer');
    assert.match(await panel.evaluate((element) => getComputedStyle(element, '::backdrop').backgroundColor), /rgba?\(15, 23, 42/, 'the page behind is dimmed');
    checks.push('Dialog is centred over a dimmed page');

    await panel.getByRole('button', { name: 'Nhận tư vấn' }).click();
    await panel.getByText(/Số khách tối đa của tour riêng luôn bằng số người của đoàn/).waitFor();
    checks.push('Agency accepts a fresh request from the pinned panel');
    await snap(agency, '02-agency-panel-editor.png');

    const title = panel.getByLabel(/Tên tour/);
    await title.fill(`${tour.title} — bản đoàn`);
    await panel.getByRole('textbox', { name: 'Mô tả chi tiết (Optional)', exact: true }).fill('Ngày 1: Hà Nội – Ninh Bình, nhận phòng và ăn tối theo thực đơn địa phương.\nNgày 2: Tràng An – Tam Cốc.\nNgày 3: tự do buổi sáng, về Hà Nội sau bữa trưa.');
    await panel.getByRole('textbox', { name: 'Bao gồm', exact: true }).fill('Xe riêng đời mới\nHướng dẫn viên riêng suốt tuyến\nBa bữa chính theo chương trình');
    await panel.getByRole('textbox', { name: 'Không bao gồm', exact: true }).fill('Chi phí cá nhân\nĐồ uống gọi thêm');
    await panel.getByRole('button', { name: 'Lưu nháp' }).click();
    await panel.getByText('Đã lưu', { exact: true }).waitFor();
    // Bring the edited details above the sticky save bar so the shot shows them, not just the description.
    await panel.getByRole('textbox', { name: 'Không bao gồm', exact: true }).scrollIntoViewIfNeeded();
    await panel.locator('div.overflow-y-auto').first().evaluate((element) => element.scrollBy(0, 120));
    checks.push('Agency edits the tour details (description, inclusions, exclusions) and saves them');
    await snap(agency, '03-agency-details-edited.png');

    await panel.getByRole('button', { name: 'Gửi thỏa thuận' }).click();
    await panel.getByText(/Đã gửi thỏa thuận, khách đang xem/).waitFor();
    checks.push('Agency sends the offer from the panel');
    await snap(agency, '04-agency-offer-sent.png');

    // 3. Traveler reviews the frozen offer and accepts it.
    await traveler.reload();
    await traveler.getByRole('button', { name: /Xem thỏa thuận/ }).click();
    const travelerPanel = traveler.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' });
    const details = travelerPanel.getByRole('region', { name: 'Thông tin tour' });
    await details.waitFor();
    const detailsText = await details.innerText();
    assert.match(detailsText, /bản đoàn/, 'the negotiated title is the frozen one');
    assert.match(detailsText, /Ninh Bình · 3 ngày/);
    assert.match(detailsText, /Hướng dẫn viên riêng suốt tuyến/);
    assert.match(detailsText, /Chi phí cá nhân/);
    assert.match((await details.locator('details').textContent()) ?? '', /Liên hệ đơn vị tổ chức/);
    const table = travelerPanel.getByRole('table');
    await table.waitFor();
    assert.match(await table.innerText(), /Người lớn/);
    assert.match(await travelerPanel.innerText(), /Đã gửi thỏa thuận/);
    checks.push('Traveler sees the negotiated tour details next to the per-group price table');
    await snap(traveler, '05-traveler-offer.png');

    await traveler.setViewportSize({ width: 390, height: 844 });
    const mobileBox = await travelerPanel.boundingBox();
    assert.deepEqual([mobileBox?.x, Math.round(mobileBox?.width ?? 0)], [16, 358], 'the dialog keeps a 16px gutter on a phone');
    assert.ok((mobileBox?.height ?? 0) <= 760, 'the dialog stays inside the phone screen');
    checks.push('Dialog fits a phone with a 16px gutter');
    await snap(traveler, '06-mobile-panel.png');
    await traveler.setViewportSize({ width: 1440, height: 1000 });

    // Escape is the native dialog's own: it closes and focus goes back to the pinned card.
    await traveler.keyboard.press('Escape');
    await traveler.waitForFunction(() => !document.querySelector('[aria-label="Thỏa thuận booking đoàn"]'));
    assert.match(await traveler.evaluate(() => document.activeElement?.textContent?.trim() ?? ''), /Xem thỏa thuận/);
    checks.push('Escape closes the dialog and returns focus to the pinned card');
    await traveler.getByRole('button', { name: /Xem thỏa thuận/ }).click();
    await travelerPanel.getByRole('button', { name: 'Chấp nhận thỏa thuận' }).waitFor();

    await travelerPanel.getByRole('button', { name: 'Chấp nhận thỏa thuận' }).click();
    const confirm = travelerPanel.getByRole('group', { name: 'Xác nhận thỏa thuận' });
    await confirm.waitFor();
    assert.match(await confirm.innerText(), /Ngày khởi hành/);
    assert.match(await confirm.innerText(), /Tổng tiền/);
    await snap(traveler, '07-traveler-accept-confirm.png');

    await confirm.getByRole('button', { name: 'Xác nhận chấp nhận' }).click();
    await travelerPanel.getByText('Bạn đã chấp nhận thỏa thuận.').waitFor();
    const passengerLink = travelerPanel.getByRole('link', { name: 'Nhập hành khách' });
    assert.equal(await passengerLink.getAttribute('href'), `/traveler/bookings/new?customTourRequestId=${requestId}`);
    checks.push('Traveler accepts the offer and is sent to the passenger form');
    await snap(traveler, '08-traveler-accepted.png');

    // 4. The agency sees the accepted state on the same card.
    await agency.reload();
    await agency.getByRole('button', { name: /Xem thỏa thuận/ }).click();
    await agency.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' }).getByText('Khách đã chấp nhận thỏa thuận.').waitFor();
    checks.push('Agency sees the accepted state');
    await snap(agency, '09-agency-accepted.png');

    // 5. The traveler fills the members; the form saves itself and survives a reload.
    await traveler.getByRole('link', { name: 'Nhập hành khách' }).click();
    await traveler.waitForURL((url) => url.pathname === '/traveler/bookings/new');
    await traveler.getByRole('heading', { name: 'Nhập thông tin hành khách' }).waitFor();
    const formText = await traveler.locator('body').innerText();
    assert.match(formText, /Người lớn 1/);
    assert.match(formText, /Giá đã chốt/);
    const rows = await traveler.locator('[id^="passenger-"][id$="-idCard"]').count();
    assert.ok(rows >= 2, `the form has a row per member (${rows})`);
    assert.equal(await traveler.locator('#contact-fullName').inputValue(), '', 'a fresh form starts empty');

    await traveler.locator('#contact-fullName').fill('Traveler Kiểm Thử');
    await traveler.locator('#contact-phone').fill('0901234567');
    for (let index = 0; index < rows; index += 1) {
      await traveler.locator(`#passenger-${index}-fullName`).fill(`Thành viên ${index + 1}`);
      await traveler.locator(`#passenger-${index}-phone`).fill(`09012345${60 + index}`);
      await traveler.locator(`#passenger-${index}-idCard`).fill(`0012040123${40 + index}`);
    }
    await traveler.getByText(/Đã lưu lúc/).waitFor();
    checks.push('Passenger form autosaves once every member is filled');
    await snap9(traveler, '01-traveler-passenger-form.png');

    await traveler.reload();
    await traveler.getByRole('heading', { name: 'Nhập thông tin hành khách' }).waitFor();
    assert.equal(await traveler.locator('#contact-fullName').inputValue(), 'Traveler Kiểm Thử');
    assert.equal(await traveler.locator('#passenger-0-idCard').inputValue(), '001204012340');
    assert.match(await traveler.locator('body').innerText(), /Thông tin đã được lưu/);
    checks.push('Reload restores the saved members with nothing left to save');
    await snap9(traveler, '02-traveler-reloaded.png');

    await traveler.setViewportSize({ width: 390, height: 844 });
    const overflow = await traveler.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `the form does not overflow a phone (${overflow}px)`);
    checks.push('Passenger form fits a phone without sideways scrolling');
    await snap9(traveler, '03-mobile-passenger-form.png');
    await traveler.setViewportSize({ width: 1440, height: 1000 });

    // 6. The form becomes the request's one booking; the detail page is where PayOS lives.
    await traveler.getByRole('button', { name: 'Đặt chỗ và thanh toán' }).click();
    await traveler.waitForURL((url) => url.pathname.startsWith('/settings/history/'));
    await traveler.getByText('Thông tin hành khách').waitFor();
    const detail = await traveler.locator('body').innerText();
    assert.match(detail, /Thành viên 1/);
    assert.match(detail, /CCCD 001204012340/);
    assert.match(detail, /Thanh toán ngay/);
    assert.match(detail, /Chi tiết thanh toán/);
    checks.push('Passenger form becomes exactly one booking and opens its PayOS detail page');
    // The page fades in (0.28s) and is taller than the viewport: show the whole booking, members included.
    await traveler.waitForTimeout(400);
    await snap10(traveler, '01-traveler-booking-detail.png', { fullPage: true });

    // 7. Resume points: the request list and the pinned card both lead back to the same booking, not the form.
    await traveler.goto(`${base}/traveler/custom-tours`);
    await traveler.getByRole('heading', { name: 'Yêu cầu đoàn của tôi' }).waitFor();
    const resume = traveler.getByRole('link', { name: 'Xem đơn' }).first();
    await resume.waitFor();
    checks.push('Request list shows the live booking instead of the passenger form');
    await snap10(traveler, '02-traveler-request-list.png', { fullPage: true });
    await resume.click();
    await traveler.waitForURL((url) => url.pathname.startsWith('/settings/history/'));
    await traveler.getByText('Chi tiết thanh toán').waitFor();
    checks.push('Request list resumes the existing booking');

    await traveler.goto(conversationUrl);
    await traveler.getByRole('button', { name: 'Xem thỏa thuận' }).click();
    await traveler.getByRole('dialog').getByRole('link', { name: 'Xem đơn' }).waitFor();
    checks.push('Pinned chat card resumes the booking too');
    await snap10(traveler, '03-chat-panel-booking.png');

    // 8. S12: the four review widths keep the lists and the dialog inside the screen, and the keyboard never
    // leaves the modal dialog. The reduced-motion context is already active for every screen above.
    assert.ok(await traveler.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the browser runs with reduced motion');
    const shots12 = [];
    const snap12 = async (page, name, options = {}) => {
      await page.screenshot({ path: path.join(reviewOutput, name), ...options });
      shots12.push(name);
    };
    for (const width of [320, 768, 1024, 1440]) {
      await traveler.setViewportSize({ width, height: 900 });
      await traveler.goto(`${base}/traveler/custom-tours`);
      await traveler.getByRole('heading', { name: 'Yêu cầu đoàn của tôi' }).waitFor();
      const listOverflow = await traveler.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(listOverflow <= 1, `the request list has no sideways scroll at ${width}px (${listOverflow}px)`);
      await snap12(traveler, `${width}-request-list.png`, { fullPage: true });

      await traveler.goto(conversationUrl);
      await traveler.getByRole('button', { name: 'Xem thỏa thuận' }).click();
      const panelAt = traveler.getByRole('dialog', { name: 'Thỏa thuận booking đoàn' });
      await panelAt.waitFor();
      const box = await panelAt.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `the dialog stays inside ${width}px (${box?.x}+${box?.width})`);
      for (let index = 0; index < 25; index += 1) await traveler.keyboard.press('Tab');
      assert.ok(
        await traveler.evaluate(() => Boolean(document.activeElement?.closest('dialog'))),
        `focus stays inside the dialog at ${width}px after 25 tabs`,
      );
      await snap12(traveler, `${width}-chat-panel.png`);
      await traveler.keyboard.press('Escape');
      await traveler.waitForFunction(() => !document.querySelector('[aria-label="Thỏa thuận booking đoàn"]'));
      assert.match(
        await traveler.evaluate(() => document.activeElement?.textContent?.trim() ?? ''),
        /Xem thỏa thuận/,
        `Escape returns focus to the pinned card at ${width}px`,
      );
    }
    checks.push('Request list and dialog fit 320/768/1024/1440px; focus is trapped and returns to the card');

    assert.deepEqual(errors, [], 'no page errors');
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ requestId, checks, shots, errors }, null, 2));
    fs.writeFileSync(path.join(checkoutOutput, 'result.json'), JSON.stringify({ requestId, checks, shots9, errors }, null, 2));
    fs.writeFileSync(path.join(bookingOutput, 'result.json'), JSON.stringify({ requestId, checks, shots10, errors }, null, 2));
    fs.writeFileSync(path.join(reviewOutput, 'result.json'), JSON.stringify({ requestId, checks, shots12, errors }, null, 2));
    console.log(JSON.stringify({ ok: true, requestId, checks, shots, shots9, shots10, shots12, errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
