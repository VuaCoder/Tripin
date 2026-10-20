# Traveler / Guide conversations

Shared routes: `/conversations` and `/conversations/:id`. Travelers start a conversation from a tour with a guide. Both roles use the same inbox and thread UI, guarded by role and `chat:use`; the backend remains responsible for membership checks.

`chatApi` uses the existing authenticated RTK Query base. `ChatProvider` owns one Socket.IO connection for the signed-in Traveler/Guide. Socket sends use a 10-second ack timeout; sends begun while disconnected use REST. An uncertain send is never retried automatically or switched to REST: the draft remains while history synchronizes.

Reconnection and visibility restoration synchronize REST history across pages until a REST-confirmed message is reached. Incoming events and REST/ack results merge by message ID. Old requests, subscriptions and drafts are disposed on route/account changes.

Message status: **Đã gửi** means persistence confirmed; **Đã nhận** means a recipient socket acknowledged `chat:message`; **Đã xem** comes from persisted `readAt`. Delivery receipts use `chat:delivered {conversationId,messageId}`, are session-local, and do not survive reload. Seen is refreshed with history, not pushed live. No presence is inferred from socket connection status.

Deployment: forward `/socket.io` (polling and WebSocket upgrade) to the backend origin configured by `NEXT_PUBLIC_API_URL`; allow the frontend origin in backend `CLIENT_URL`. No conversation-room joins or database migrations are needed.

Verification: `pnpm --filter frontend test features/chat`; `pnpm --filter backend exec vitest run src/modules/chat/__tests__`. Manual acceptance should use separate authenticated Traveler/Guide browser sessions, including REST fallback, reconnection, mobile layout, and an unrelated third account.

## Reproducible browser acceptance

1. In a backend terminal, set `CLIENT_URL=http://localhost:3002` and run `pnpm --filter backend exec tsx src/test/chat-browser-server.ts`. On Windows, `TEMP`/`TMP` must point to a writable ASCII path. This starts a disposable migrated PostgreSQL database and API on port 3003 with test-only accounts; it does not connect to the application's configured database.
2. In another terminal, set `NEXT_PUBLIC_API_URL=http://localhost:3003/api/v1` and `TRIPRI_VERIFY_BUILD=1`, then run `pnpm --filter frontend exec next dev -p 3002`.
3. From `backend`, run `node src/test/chat.browser-smoke.cjs` with Playwright installed (or set `PLAYWRIGHT_MODULE` to an available installation). It uses installed Microsoft Edge headless, logs in through the UI, tests real REST/Socket.IO, and writes screenshots and a JSON report under `test-results/chat-browser`.
4. Stop both test servers after verification. The backend's normal shutdown stops its disposable PostgreSQL server and removes the runtime/data directory.

The regression test covers reconnecting an initially empty conversation after only live messages: an empty REST checkpoint must not stop recovery at the first page.
