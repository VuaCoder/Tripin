# ai

The "Chat with AI" assistant: a Traveler talks to an AI Agent about travel. The language model sits behind a provider
interface so no vendor is hard-wired (and Custom Tour can reuse it later).

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|
| Chat with AI (AI Agent) | Traveler | `POST /ai/chat`, `GET /ai/conversations`, `GET /ai/conversations/:id` |

## Files
| File | Role |
|---|---|
| `ai.service.ts` | Flow: guard → build context → provider → store the exchange |
| `providers/ai.provider.ts` | `AiProvider` interface (`enabled`, `generate`) |
| `providers/anthropic.provider.ts` | Anthropic Messages API over `fetch` (no SDK) |
| `providers/disabled.provider.ts` | Default provider: every call answers 503 |
| `providers/index.ts` | `createAiProvider()` – selected by `AI_PROVIDER` |
| `ai.model.ts` / `.repository.ts` / `.mapper.ts` / `.types.ts` | transcript persistence, DTOs, limits and the fixed system prompt |
| `ai.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (`aiRouter`) |
| `index.ts` | Public API (`AiProvider` for future modules) |

## API (base `/api/v1`, permission `ai:chat`)
* `POST /ai/chat` `{ conversationId?, message (1..2000) }` → `{ conversationId, reply{role:'assistant',content,createdAt}, messageCount }`. Omit `conversationId` to start a new chat (its title is the first message). Limiter: 15 requests/min/IP.
* `GET /ai/conversations?page&limit` → `[{ id, title, messageCount, updatedAt }]`; `GET /ai/conversations/:id` → full transcript.
* Errors: 503 when the AI is disabled/unavailable, 404 for other people's chats, 409 `AI_CONVERSATION_FULL` (100 messages).

## Configuration
`AI_PROVIDER=disabled|anthropic` (default `disabled`), `AI_API_KEY`, `AI_MODEL` (required for `anthropic`; the model id is not hard-coded). Without them the endpoint answers 503 and nothing leaves the server.

## Business rules (AI rules §13–14)
1. **Advice only.** The reply is shown to the user; it is never parsed, executed or saved as a booking, tour, price or any other business record. The assistant has no tools, so it cannot create or change data.
2. The only things sent to the vendor are the fixed system prompt and the user's own chat messages (last 20). No profile, booking or payment data is attached.
3. The system prompt tells the model it cannot see live prices/availability, cannot book or pay, and must not request secrets.
4. A transcript is stored only after a **successful** exchange; a provider outage leaves nothing behind.
5. Conversations are private: every query is scoped by `userId`; other users get 404.
6. Limits: 100 messages per conversation (atomic guard), reply stored up to 8000 characters, 1024 output tokens.
7. Vendor errors are mapped to a generic 503; keys and vendor messages are never returned or logged.

## State machine
None.

## Data model
`AiConversation { userId, title, messages[{role,content,createdAt}], messageCount }`, index `(userId, updatedAt desc)`. Lists exclude `messages`.

## Permissions
`ai:chat` (TRAVELER).

## Dependencies
* Uses: `config/env`. No other module.
* Used by: future Custom Tour (through `AiProvider`).

## Events / side effects
Outbound HTTPS call to the configured vendor.

## Testing
`__tests__/ai.integration.test.ts` – real MongoDB with a fake model injected into the service: off by default (503, nothing stored), history and fixed system prompt only (no tools), conversations private to the owner (a stranger's attempt never reaches the model), a failing model leaves nothing behind, replies/injections are stored and returned as plain text and never change business data, input limits, reply cap, context window, conversation cap under parallel requests, role gating.
`__tests__/ai.service.test.ts` – prompt/context building, atomic storage, failure atomicity, disabled mode, ownership, size limits, and both providers (request shape, text joining, error mapping).

## Not implemented / follow-ups
* Grounding answers in the public tour catalogue (retrieval) and Custom Tour request drafting (AI rules §13): when added, the flow must stay AI output → validate → show → user confirms → persist.
* Streaming responses, per-user daily quota, content moderation of the transcript.
* Verify the Anthropic request/response shape against a real key before enabling in production.
