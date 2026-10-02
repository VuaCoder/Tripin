# Module README template

Copy this into `backend/src/modules/<name>/README.md`. Keep every heading; write "None" instead of deleting one.
Document what **exists**, never what is planned (plans go under "Not implemented / follow-ups").

````markdown
# <Module name>

One-paragraph purpose: which use case(s) of `docs/architecture/TripRi.json` this module implements and who the actors are.

## Use cases covered
| Use case (diagram) | Actor | Endpoint |
|---|---|---|

## Files
| File | Role |
|---|---|

## API (base `/api/v1`)
For every endpoint: method + path, auth (GUEST / permission), request (body/query/params), response, errors.

## Business rules
Numbered, testable rules (ownership, limits, validation that is not obvious).

## State machine
Statuses + allowed transitions (table or diagram). "None" if the entity has no status.

## Data model
Collections, important fields, indexes and why (paginated lists: the index ends with `_id`; a partial index is only used when the query repeats its condition).

## Permissions
Which `PERMISSIONS.*` guard which route; ownership rules enforced in the service.

## Dependencies
* Uses: other modules (through their `index.ts`) and integrations.
* Used by: modules that call this module.

## Events / side effects
Emails, notifications, audit records, realtime events triggered here.

## Testing
How to run the tests of this module and what they cover: unit tests (fake repositories) and the `*.integration.test.ts` scenarios (real MongoDB) - races, ownership, permissions.

## Not implemented / follow-ups
Honest list of gaps, assumptions (link to `docs/backend/DECISIONS.md` entries).
````
