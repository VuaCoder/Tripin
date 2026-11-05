# Traveler / Guide conversations

Shared routes: `/conversations` and `/conversations/:id`. Travelers start a conversation from a tour with a guide. Both roles use the same inbox and thread UI, guarded by role and `chat:use`; the backend remains responsible for membership checks.

`chatApi` uses the existing authenticated RTK Query base. `ChatProvider` owns one Socket.IO connection for the signed-in Traveler/Guide. Socket sends use a 10-second ack timeout; sends begun while disconnected use REST. An uncertain send is never retried automatically or switched to REST: the draft remains while history synchronizes.

Reconnection and visibility restoration synchronize REST history across pages until a REST-confirmed message is reached. Incoming events and REST/ack results merge by message ID. Old requests, subscriptions and drafts are disposed on route/account changes.

Message status: **Đã gửi** means persistence confirmed; **Đã nhận** means a recipient socket acknowledged `chat:message`; **Đã xem** comes from persisted `readAt`. Delivery receipts use `chat:delivered {conversationId,messageId}`, are session-local, and do not survive reload. Seen is refreshed with history, not pushed live. No presence is inferred from socket connection status.

Deployment: apply migration `20261024000000_ai_message_read_state` with `pnpm --filter backend db:deploy`, regenerate Prisma with `pnpm --filter backend db:generate`, then deploy backend and frontend. The migration preserves history and marks existing AI replies as read. Forward `/socket.io` (polling and WebSocket upgrade) to the backend origin configured by `NEXT_PUBLIC_API_URL`; allow the frontend origin in backend `CLIENT_URL`. No conversation-room joins are needed.

AI: the pinned inbox entry uses `/ai/overview`, independent of the paginated history panel inside the thread. New chat clears local state only; a new record is created after a successful exchange. Assistant unread state is persisted through a displayed message ID, only while the selected thread is visible and at the bottom. `ai:updated` and `chat:updated` invalidate server summaries across devices; they never increment client counters. Offline visible tabs refresh every 30 seconds. Time labels use the device timezone, refresh each minute/on visibility change, and group transcripts by calendar date.

Verification: `pnpm --filter frontend test features/chat`; `pnpm --filter backend exec vitest run src/modules/chat/__tests__`. Manual acceptance should use separate authenticated Traveler/Guide browser sessions, including REST fallback, reconnection, mobile layout, and an unrelated third account.

## Reproducible browser acceptance

1. In a backend terminal, set `CLIENT_URL=http://localhost:3002` and run `pnpm --filter backend exec tsx src/test/chat-browser-server.ts`. On Windows, `TEMP`/`TMP` must point to a writable ASCII path. This starts a disposable migrated PostgreSQL database and API on port 3003 with test-only accounts; it does not connect to the application's configured database.
2. In another terminal, set `NEXT_PUBLIC_API_URL=http://localhost:3003/api/v1` and `TRIPRI_VERIFY_BUILD=1`, then run `pnpm --filter frontend exec next dev -p 3002`.
3. From `backend`, run `node src/test/chat.browser-smoke.cjs` with Playwright installed (or set `PLAYWRIGHT_MODULE` to an available installation). It uses installed Microsoft Edge headless, logs in through the UI, tests real REST/Socket.IO, and writes screenshots and a JSON report under `test-results/chat-browser`.
4. Stop both test servers after verification. The backend's normal shutdown stops its disposable PostgreSQL server and removes the runtime/data directory.

The regression test covers reconnecting an initially empty conversation after only live messages: an empty REST checkpoint must not stop recovery at the first page.

For AI acceptance, also set `CHAT_SMOKE_AI=1` on the disposable backend and run `node src/test/ai-chat.browser-smoke.cjs`. The local-only model and 22 seeded conversations cover history pagination, previews, unread updates, continuing an old conversation, fresh-chat preservation, reload, and desktop/mobile screenshots in `test-results/ai-chat-browser`.
