# Shared promotion editor

`PromotionFormDialog.tsx`, `validation.ts` and `payload.ts` serve both Agency promotions and Super Admin platform promotions. They contain no API calls or role routing. Callers own the mutation, server error, pending state and saved feedback.

The existing `features/agency-promotions` exports remain compatible. Validation mirrors backend field bounds and immutable/redeemed fields; backend service validation remains authoritative. Optional numeric fields already stored cannot be cleared through the current PATCH contract, so the editor asks for a retained/replacement value rather than silently ignoring a clear. Datetime-local values are converted to ISO instants; unchanged minute values do not rewrite stored seconds.
