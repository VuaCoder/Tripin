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
| `providers/gemini.provider.ts` | Google Gemini generateContent API over `fetch`; JSON mode for document extraction |
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
`AI_PROVIDER=disabled|anthropic|gemini` (default `disabled`), `AI_API_KEY`, `AI_MODEL` (key and model required for either active provider; the model id is not hard-coded). Without them the endpoint answers 503 and nothing leaves the server.

For Gemini, edit the monorepo root `.env`: set `AI_PROVIDER=gemini`, `AI_API_KEY` to your Google AI Studio API key and `AI_MODEL` to a model ID available to that key (bare ID or `models/<id>`). Restart the backend. These settings select the provider for **both chat and Agency document extraction**; never put the key in frontend env variables. Gemini receives a system instruction and user/model message parts through `POST https://generativelanguage.googleapis.com/v1beta/models/<id>:generateContent`, with the key in `x-goog-api-key`. Extraction requests JSON output, while chat keeps text output. Only complete `STOP` responses are accepted; blocked, truncated, empty, rate-limited and failed requests return 503 without exposing vendor details.

## Business rules (AI rules §13–14)
1. **Advice only.** The reply is shown to the user; it is never parsed, executed or saved as a booking, tour, price or any other business record. The assistant has no tools, so it cannot create or change data.
2. Chat sends the fixed system prompt and the user's own chat messages (last 20). Agency document extraction is a separate consumer of `AiProvider`: it sends extracted document text and the active category catalogue only after an authorized Agency upload; it does not attach profile, booking or payment data.
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
* Used by: Agency tour document extraction in `tours` (through `AiProvider`). Custom Tour remains out of scope.

## Events / side effects
Outbound HTTPS call to the configured vendor for chat or Agency-approved document extraction. Extraction input is transient and is never stored as an AI conversation or tour record.

## Testing
`__tests__/ai.integration.test.ts` – real PostgreSQL with a fake model injected into the service: off by default (503, nothing stored), history and fixed system prompt only (no tools), conversations private to the owner (a stranger's attempt never reaches the model), a failing model leaves nothing behind, replies/injections are stored and returned as plain text and never change business data, input limits, reply cap, context window, conversation cap under parallel requests, role gating.
`__tests__/ai.service.test.ts` – prompt/context building, atomic storage, failure atomicity, disabled mode, ownership, size limits, and disabled/Anthropic providers (request shape, text joining, error mapping).
`__tests__/gemini.provider.test.ts` – provider selection/configuration, Gemini request mapping, JSON extraction mode, text chat mode, thought-part filtering, incomplete/blocked responses and generic failure mapping (mocked HTTP; no paid requests).

## Not implemented / follow-ups
* Grounding chat answers in the public tour catalogue (retrieval). Any future business-data extraction must keep the flow AI output → validate → show → user confirms → persist.
* Streaming responses, per-user daily quota, content moderation of the transcript.
* Verify the Anthropic request/response shape against a real key before enabling in production.
