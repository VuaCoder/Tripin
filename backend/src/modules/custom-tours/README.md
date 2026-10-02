# custom-tours

> **Status: placeholder — no code, no routes, no collections.** Custom Tour is a first-class domain in the repository
> architecture, but it is **not part of the current use-case diagram**, so it is intentionally not implemented yet.

## Use cases covered
None. (The diagram's "Chat with AI" is implemented by the `ai` module and does not create custom-tour requests.)

## Files
Only this README.

## API
None.

## Planned flow (AI rules §13, for the future implementation)
```
Traveler → Custom Tour Request → AI assistance → user reviews/edits → submit
        → Agency/Guide receives request → Proposal → Traveler reviews → negotiation (chat)
        → Traveler accepts proposal → Booking → Payment → E-ticket
```

## Business rules (constraints that already apply)
1. **AI output is advice only.** AI → validate → show to the user → user confirms/edits → persist the *user-confirmed* data. Never AI → persist.
2. AI is reached only through `AiProvider` (`modules/ai/providers`), never a vendor SDK/HTTP call from this module.
3. Booking, payment and e-ticket must reuse `bookings`, `payments` (PayOS provider abstraction) and `e-tickets`; a proposal needs a way to become a priced departure (design decision for the owner).
4. Chat with the provider must extend `chat.policy.canConverse` (today only Traveler ↔ Tour guide, D-13) — one function to change.
5. Request/proposal statuses need an explicit state machine (`assertTransition`) before any endpoint exists.

## State machine / Data model / Permissions
Not defined yet. Proposed permission names would follow `custom-tour:*` in `packages/constants`.

## Dependencies
None today. Expected later: `ai`, `chat`, `bookings`, `payments`, `notifications`, `users`.

## Events / side effects
None.

## Testing
None.

## Not implemented / follow-ups
The whole domain, pending an owner decision on scope. See `docs/backend/DECISIONS.md` D-56.

## Guard
`src/scripts/__tests__/build-smoke.integration.test.ts` fails if this folder gains code or a `/api/v1` route before the owner approves the feature (DECISIONS D-56).
