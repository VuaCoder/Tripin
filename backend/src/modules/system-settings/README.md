# system-settings

Platform-wide configuration owned by the Super admin: the **commission rate** and the **policy documents**
(cancellation, refund, terms, privacy). Other modules read these values through `systemSettingsService`; nothing else
may hard-code them (AI rules §25).

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| Set platform commission rates | Super admin | `GET /admin/settings/commission`, `PUT /admin/settings/commission` |
| Configure System Policies | Super admin | `PUT /admin/policies/:key` |
| (supporting) read policies | Guest and everyone | `GET /policies`, `GET /policies/:key` |

## Files
| File | Role |
|---|---|
| `system-settings.types.ts` | `POLICY_KEYS`, DTOs, setting keys, defaults |
| `system-settings.model.ts` / `.repository.ts` | One `SystemSetting` document per key |
| `system-settings.service.ts` | Commission + policy rules, audit |
| `system-settings.validation.ts` / `.controller.ts` / `.routes.ts` | HTTP layer (3 routers) |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `GET /policies`, `GET /policies/:key` – public. `key` ∈ `cancellation | refund | terms | privacy`. Never-edited policies return their defaults (empty content).
* `PUT /admin/policies/:key` – `policy:configure`; body `{ title, content, params? }` (`params` = flat map of number/string/boolean, ≤ 30 keys). Replaces the document.
* `GET /admin/settings/commission` / `PUT` – `commission:configure`; body `{ ratePercent }` (0–100, max 2 decimals). Response `{ ratePercent, rateBps, updatedAt }`.

## Business rules
1. Commission is stored in basis points (integer); money code must use `rateBps`.
2. Commission defaults to **0** until set (DECISIONS D-25) — a deliberate "owner must decide" default.
3. A commission change only affects bookings created afterwards (each booking snapshots the rate).
4. `cancellation.params.cancellationWindowHours` (default 24) is the knob `bookings` uses to refuse late cancellations.
5. Every change is audited (`settings.commission_updated`, `settings.policy_updated`).

## State machine
None.

## Data model
`SystemSetting { key (unique), value (Mixed), updatedBy, timestamps }`. Keys: `commission`, `policy:<key>`.

## Permissions
`commission:configure`, `policy:configure` (SUPER_ADMIN). Reading policies is public.

## Dependencies
* Uses: `audit`.
* Used by: `bookings` (commission snapshot, cancellation window), `earnings`, `payments`.

## Events / side effects
Audit records only.

## Testing
Real-database scenarios: `users/__tests__/admin.integration.test.ts` (commission snapshot in bookings, policy keys/limits, audit entries).
`__tests__/system-settings.service.test.ts` – defaults, bps rounding, audit, params merge.

## Not implemented / follow-ups
* No history/versioning of policy text (only the audit metadata title/params).
* Per-agency or per-category commission is not modelled (diagram only has "platform commission rates").
