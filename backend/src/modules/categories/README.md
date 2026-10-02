# categories

Tour categories configured by the Super admin and used by agencies (to classify tours) and guests (to filter them).

## Use cases covered
| Use case | Actor | Endpoint |
|---|---|---|
| Config Tour Categories | Super admin | `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` |
| (supporting) list categories for Filter tours | Guest | `GET /categories` |

## Files
| File | Role |
|---|---|
| `categories.model.ts` / `.repository.ts` | `Category` schema + DB access |
| `categories.service.ts` | Rules: unique slug, deactivate-instead-of-delete, audit, `assertActiveIds` for tours |
| `categories.validation.ts` / `.controller.ts` / `.routes.ts` / `.mapper.ts` / `.types.ts` | HTTP + DTO |
| `index.ts` | Public API |

## API (base `/api/v1`)
* `GET /categories` – public, active only, ordered by `sortOrder`, `name`.
* `GET /admin/categories` – all, including inactive.
* `POST /admin/categories` `{ name, description?, sortOrder? }` → 201; 409 `CATEGORY_EXISTS` when the slug exists.
* `PATCH /admin/categories/:id` – any of `name, description, sortOrder, isActive` (at least one); renaming regenerates the slug.
* `DELETE /admin/categories/:id` – 204; **deactivates** (idempotent), see rule 3. All admin routes need `category:configure`.

## Business rules
1. `slug` is derived from `name` (diacritics stripped, e.g. "Đà Nẵng" → `da-nang`) and unique.
2. Names that produce an empty slug are rejected.
3. Delete = `isActive:false` so tours keep a valid reference (DECISIONS D-24); re-activate with PATCH `isActive:true`.
4. `assertActiveIds(ids)` is the only way tours may validate categories.

## State machine
`isActive` true ⇄ false (no further workflow).

## Data model
`Category { name, slug (unique), description?, isActive, sortOrder }`; index `(isActive, sortOrder, name)` for the public list.

## Permissions
`category:configure` on every admin route; public list needs none.

## Dependencies
* Uses: `audit`, `utils/slug`.
* Used by: `tours`.

## Events / side effects
Audit: `category.created`, `category.updated`, `category.deleted`.

## Testing
Real-database scenarios: `users/__tests__/admin.integration.test.ts` (public ordering, deactivate/re-activate, parallel create gives one category).
`__tests__/categories.service.test.ts` – slug, duplicates, rename clash, deactivate, id assertion.

## Not implemented / follow-ups
* No hierarchy (parent/child) – not in the diagram.
* No category images/icons.
