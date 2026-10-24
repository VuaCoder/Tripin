# complaints

Direct two-way complaint and service-recovery ticket system between travelers and travel agencies with moderator oversight and CSAT quality analytics.

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| Open tour complaint ticket | Traveler | `POST /complaints` |
| View traveler complaints | Traveler | `GET /complaints/me`, `GET /complaints/:id` |
| Exchange messages | Traveler / Agency / Moderator | `POST /complaints/:id/messages` |
| Propose resolution | Agency | `POST /agency/complaint-tickets/:id/resolve` |
| Accept resolution & close | Traveler | `POST /complaints/:id/accept-resolution` |
| Escalate to platform moderation | Traveler / Agency | `POST /complaints/:id/escalate` |
| Adjudicate escalated dispute | Moderator | `POST /moderation/complaint-tickets/:id/adjudicate` |
| Rate agency support quality (CSAT) | Traveler | `POST /complaints/:id/feedback` |
| Quality monitoring dashboard | Moderator | `GET /moderation/complaint-tickets/dashboard/agency-quality` |

## Files
| File | Role |
|---|---|
| `complaints.service.ts` | Ticket lifecycle, access control, notification dispatch, CSAT stats |
| `complaints.repository.ts` | Prisma queries for tickets, messages, feedbacks |
| `complaints.types.ts` | Ticket statuses, priorities, categories, DTO interfaces |
| `complaints.validation.ts` | Zod validation schemas for request bodies, params and queries |
| `complaints.controller.ts` | Express controllers |
| `complaints.routes.ts` | Router declarations mounted at `/complaints`, `/agency/complaint-tickets`, `/moderation/complaint-tickets` |
| `index.ts` | Public API |
