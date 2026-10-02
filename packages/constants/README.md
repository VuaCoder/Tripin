# @travel-platform/constants

Shared constants used by backend and (later) frontend: roles, permissions, status enums.

- `src/roles.ts` – access actors (`GUEST` is never persisted).
- `src/permissions.ts` – permission catalogue mapped 1:1 to the use-case diagram, plus `ROLE_PERMISSIONS` and `resolvePermissions()`.
- `src/auth.ts` – user status, OTP purposes, agency verification status.

Rule: a domain concept used by more than one module (status, role, permission) is defined here once. Module-private
state machines live in the module itself (`<module>.types.ts`).

The package exports TypeScript source directly (`main: src/index.ts`); `tsx`/`vitest` compile it and `tsup` bundles it
into the API build.
