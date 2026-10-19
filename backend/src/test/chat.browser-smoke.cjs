/* Run against chat-browser-server.ts and a frontend on :3002. PLAYWRIGHT_MODULE
 * may point to the bundled Playwright installation when it is not in the repo. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://localhost:3002';
const api = 'http://localhost:3003/api/v1';
const output = path.resolve(process.cwd(), '../test-results/chat-browser');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const contexts = [];
  const errors = [];
  const checks = [];
  try {
    let disconnected = false;
    const sockets = [];
    async function session(email, intercept = false) {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } }); contexts.push(context);
      context.setDefaultTimeout(20000);
      if (intercept) {
        await context.route(/\/socket\.io\//, route => disconnected ? route.abort() : route.continue());
        await context.routeWebSocket(/\/socket\.io\//, route => {
          if (disconnected) { route.close(); return; }
          const server = route.connectToServer(); sockets.push({ route, server });
        });
      }
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/login`);
      await page.locator('#user-credential').fill(email);
      await page.locator('#user-password').fill('ChatSmoke2026!');
      const response = page.waitForResponse(response => response.url() === `${api}/auth/login` && response.request().method() === 'POST');
      await page.locator('form[data-purpose="login-form"] button[type="submit"]').click();
      const login = await (await response).json(); assert.equal(login.success, true, JSON.stringify(login));
      await page.waitForURL(url => !url.pathname.includes('/login'));
      return { page, context, token: login.data.accessToken };
    }
    const traveler = await session('traveler@chat.test', true);
    console.log('Traveler logged in');
    const guide = await session('guide@chat.test');
    console.log('Guide logged in');
    checks.push('Independent Traveler and Guide UI logins');
    const tours = await (await traveler.context.request.get(`${api}/tours`)).json();
    const tourId = tours.data[0].id;
    await traveler.page.goto(`${base}/tours/${tourId}`);
    console.log('Tour loaded');
    await traveler.page.getByRole('button', { name: 'Nhắn tin cho hướng dẫn viên' }).click();
    await traveler.page.waitForURL(/\/conversations\/[0-9a-f-]+$/);
    const conversationId = traveler.page.url().split('/').pop();
    await traveler.page.getByLabel('Nội dung tin nhắn', { exact: true }).waitFor();
    checks.push('Start conversation from assigned guide on tour');
    await guide.page.goto(`${base}/conversations`);
    await guide.page.locator(`a[href="/conversations/${conversationId}"]`).waitFor();
    await guide.page.locator(`a[href="/conversations/${conversationId}"]`).click();
    async function send(page, text) {
      await page.getByLabel('Nội dung tin nhắn', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
      await page.getByRole('log').getByText(text, { exact: true }).waitFor();
    }
    const first = `Xin chào hướng dẫn viên! Tiếng Việt: Đà Nẵng, Hội An. ${Date.now()}`;
    await send(traveler.page, first);
    await guide.page.getByRole('log').getByText(first, { exact: true }).waitFor();
    await traveler.page.getByText('Đã nhận', { exact: false }).first().waitFor();
    const reply = 'Chào Traveler! Tôi đã nhận được tin nhắn của bạn.';
    await send(guide.page, reply);
    await traveler.page.getByRole('log').getByText(reply, { exact: true }).waitFor();
    assert.equal(await traveler.page.getByRole('log').getByText(first, { exact: true }).count(), 1);
    checks.push('Bidirectional realtime Vietnamese messages, delivery receipt and echo deduplication');
    await guide.page.goto(`${base}/conversations`);
    await send(traveler.page, `Tin chưa đọc ${Date.now()}`);
    await guide.page.getByLabel(/\d+ tin chưa đọc/).first().waitFor();
    await guide.page.locator(`a[href="/conversations/${conversationId}"]`).click();
    checks.push('Guide inbox receives unread badge');
    await traveler.page.screenshot({ path: path.join(output, 'traveler-desktop.png'), fullPage: true });
    await guide.page.screenshot({ path: path.join(output, 'guide-desktop.png'), fullPage: true });
    disconnected = true;
    sockets.forEach(({ route, server }) => { route.close(); server.close(); });
    await traveler.page.getByText(/Mất kết nối realtime|Không thể kết nối realtime/).waitFor();
    const fallback = 'Tin nhắn qua REST khi mất socket';
    const restSent = traveler.page.waitForResponse(response => response.url().endsWith(`/conversations/${conversationId}/messages`) && response.request().method() === 'POST');
    await send(traveler.page, fallback); assert.equal((await restSent).status(), 201);
    await guide.page.getByRole('log').getByText(fallback, { exact: true }).waitFor();
    checks.push('Disconnected socket falls back to REST while counterpart receives realtime');
    const gapPrefix = `Bù lịch sử ${Date.now()}`;
    for (let i = 0; i < 35; i++) {
      const result = await guide.context.request.post(`${api}/chat/conversations/${conversationId}/messages`, { headers: { Authorization: `Bearer ${guide.token}` }, data: { text: `${gapPrefix} ${i.toString().padStart(2, '0')}` } });
      assert.equal(result.status(), 201);
    }
    disconnected = false;
    await traveler.page.getByRole('button', { name: 'Kết nối lại' }).click();
    await traveler.page.getByRole('log').getByText(`${gapPrefix} 00`, { exact: true }).waitFor();
    await traveler.page.getByRole('log').getByText(`${gapPrefix} 34`, { exact: true }).waitFor();
    assert.equal(await traveler.page.getByRole('log').locator('p').filter({ hasText: gapPrefix }).count(), 35);
    checks.push('Reconnect recovers all 35 missed messages over multiple REST pages');
    await traveler.page.reload();
    await traveler.page.getByRole('log').getByText(`${gapPrefix} 34`, { exact: true }).waitFor();
    await traveler.page.getByRole('button', { name: 'Tải tin cũ' }).click();
    await traveler.page.getByRole('log').getByText(first, { exact: true }).waitFor();
    await traveler.page.getByRole('log').getByText('Đã xem', { exact: false }).first().waitFor();
    checks.push('Reload preserves history and older-message pagination works');
    await traveler.page.setViewportSize({ width: 390, height: 844 });
    await traveler.page.screenshot({ path: path.join(output, 'traveler-mobile.png'), fullPage: true });
    assert.equal(await traveler.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await traveler.page.getByRole('link', { name: 'Về danh sách', exact: true }).click();
    await traveler.page.locator(`a[href="/conversations/${conversationId}"]`).waitFor();
    await traveler.page.screenshot({ path: path.join(output, 'inbox-mobile.png'), fullPage: true });
    await guide.page.setViewportSize({ width: 390, height: 844 });
    await guide.page.screenshot({ path: path.join(output, 'guide-mobile.png'), fullPage: true });
    checks.push('Traveler and Guide mobile layouts and inbox/back navigation');
    const outsider = await session('outsider@chat.test');
    const forbidden = await outsider.context.request.get(`${api}/chat/conversations/${conversationId}`, { headers: { Authorization: `Bearer ${outsider.token}` } });
    assert.equal(forbidden.status(), 404);
    await outsider.page.goto(`${base}/conversations/${conversationId}`);
    await outsider.page.getByText('Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.').waitFor();
    assert.equal(await outsider.page.getByLabel('Nội dung tin nhắn', { exact: true }).count(), 0);
    checks.push('Unrelated third account receives 404 and cannot view or send');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, output }, null, 2));
  } catch (error) {
    for (let i = 0; i < contexts.length; i++) {
      const page = contexts[i].pages()[0];
      if (page) { await page.screenshot({ path: path.join(output, `failure-${i}.png`), fullPage: true }).catch(() => {}); console.log(`Page ${i}: ${(await page.locator('body').innerText().catch(() => '')).slice(-2500)}`); }
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: false, checks, error: String(error), errors }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
