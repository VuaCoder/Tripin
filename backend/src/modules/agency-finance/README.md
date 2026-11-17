# Agency accounting V2

Implemented 17 November 2026. The platform collects customer payments, releases eligible Agency earnings into a withdrawable balance, and records external bank transfers after Agency withdrawal requests. This is an operational subledger; exports are not tax invoices or statutory financial statements.

## Fixed policy update — 17 November 2026

Policy editing has been removed. `finance.policy.ts` defines automatic settlement after 7 days, withdrawals from VND 100,000 to VND 500,000,000 per request, a VND 1,000,000,000 daily limit per Agency, and a 48-hour processing target. Migration `20261117000500_fixed_finance_policy_bank_access` activates its immutable system version and repairs missing bank-management grants on legacy OWNER roles. Migration `20261117000600_owner_bank_permission_default` also extends the database role defaults for future Agencies. Earlier captured settlement timing and existing transfer records remain unchanged. Genuine receipt, report, dispute, bank and hold checks still apply. System-authored policy/audit records have no human actor.

## Screens

- `/super-admin/finance`: global dashboard, collection/commission charts, wallet distribution, pending-balance aging, actionable work queues, searchable paginated Agency cards, withdrawals and PayOS reconciliation. LIVE is the default source; TEST and UNKNOWN have separate views.
- Policy conditions are read-only in the accounting dashboard. `/super-admin/finance/settings` redirects to the dashboard; there is no policy editor.
- `/super-admin/finance/agencies/:agencyId`: Agency identity, balances, settlement sources/holds, withdrawals, bank verification, historical payouts and audit.
- `/agency/finance`: pending, available, reserved and frozen balances; withdrawal request/cancellation, settlement status, transactions, reconciliation, bank information, historical payouts and exports.

Agency receiving bank details are also editable at `/agency/settings/bank-account` from the Agency sidebar: bank name, account number and account holder. This uses the same saved account as finance, with version checks and wallet refresh after updates.

## Admin early settlement

For local workflow testing, `FINANCE_SANDBOX_AGENCY_IDS` accepts an explicit comma-separated Agency UUID allowlist. It is ignored in production. Only allowlisted TEST sources with provider `TEST-FINANCE` may exercise settlement; payment matching, report, hold, dispute and other checks still apply. Their wallet uses TEST entries while the default LIVE dashboard excludes them. No source is promoted to LIVE and no bank/gateway call occurs. Remove the UUID to disable the exception.

Run `DEV_AGENCY02_PASSWORD=<chosen-password> tsx src/scripts/seed-agency02-finance-demo.ts --apply-agency02-demo` from `backend`, then add its printed Agency UUID to the local allowlist and restart the API. This creates `agency02@tripri.test`, a private completed trip, a submitted report and three MATCHED TEST receipts: VND 8,000,000 gross, VND 800,000 commission, VND 7,200,000 pending. The report is submitted now, so manual early settlement can be exercised before seven days elapse. Re-running preserves credentials, reports, releases and bank details; it never resets money or calls early settlement. Test transfers must also remain outside real banking.

A single “Quyết toán ngay” button above the Admin settlement table handles the entire selected Agency, across all list pages. Its dialog requires one reason and calls `POST /api/v1/admin/finance/settlements/:agencyId/release-all`. The operation scans unsettled booking receipts in UUID cursor batches, including records not yet discovered by the scheduled worker. Each eligible booking is released atomically; blocked records are skipped, unexpected row failures are counted and logged, and the result reports released/skipped/failed counts and the actual amount credited. Already released records cannot be credited twice. This skips only the hold period. The backend rechecks the active Super Admin, genuine matched payment, submitted completion report, booking completion, disputes, manual holds, historical payouts and available liability under the same transaction/Agency lock as scheduled settlement.

A release records the Admin, reason, original eligibility date and early-release flag in the existing append-only audit. The eligibility date is preserved. Repeated or concurrent requests share the booking settlement event key, so funds and commission are posted once. This credits withdrawable earnings; it does not transfer money to a bank or bypass withdrawal checks. No additional migration is required.

## Money flow

Booking, payment and e-ticket writers acquire the Agency row lock before booking/payment rows or promotion locks, matching settlement writers. Database source triggers remain enabled. This prevents lock-order inversions during concurrent payment, cancellation and ticket issuance. Migration `20261117000700_finance_role_defaults` aligns new OWNER/ACCOUNTANT finance grants with application defaults and repairs untouched existing templates while preserving deliberately edited roles.

1. A paid booking produces a transactional outbox event and balanced PAYMENT journal. Receipt ingestion alone does not prove independent payment. Existing or unverified sources remain UNKNOWN; explicit demo sources remain TEST.
2. Reconciliation compares booking/order/link/reference/currency and independently retrieved PayOS transaction amounts. Only verified genuine sources may become LIVE. A TEST source is never promoted to LIVE by reconciliation.
3. The minute maintenance job checks at most 100 least-recently-checked settlement records per pass. A booking needs a completed trip, submitted Agency report, elapsed hold period, verified Agency, matching receipt, and no unresolved complaint, financial obligation, manual hold or historical payout reservation. A single bad record does not stop the remaining records. Heartbeat and errors are visible to Admin.
4. Settlement posts an idempotent internal movement from `AGENCY_PAYABLE` to `AGENCY_AVAILABLE`; it does not decrease platform cash. Commission becomes earned through a separate balanced reclassification. Each booking captures its policy once; later configuration edits or report amendments do not restart its hold period.
5. Agency requests a withdrawal against available LIVE funds and a verified current bank account. Atomic allocation and a stable request key prevent double reservation or duplicate requests. Funds move to `AGENCY_RESERVED`.
6. Admin approves, accepts processing, transfers outside the application, then records exact amount, actual transfer time, bank reference and private evidence. Only the assigned processor can finish the transfer. Completion debits the reservation and credits platform cash exactly once. The requester cannot approve their own request.
7. Agency can cancel a pending request. Admin can reject pending/approved requests. A processing request with an unknown bank outcome stays reserved; confirmed failure requires documentation before releasing funds. Changed bank versions block transfer completion. Bank references are checked against both withdrawals and historical payouts.

New disputes or source discrepancies freeze unreserved released funds. Every withdrawal stage rechecks its allocated bookings. Removing a manual hold cannot bypass other blocking conditions. Historical payouts remain readable and cannot be settled a second time through the wallet.

## Activation and deployment

1. Apply `20261117000300_agency_accounting` and `20261117000400_agency_wallet_settlement`, testing on isolated PostgreSQL first. Deploy backend/frontend and the matching generated Prisma client together. Migrations preserve financial history and do not enable automation or label unknown receipts as real.
2. Configure PayOS merchant credentials and persistent `PAYOUT_ENCRYPTION_KEY_ID` / `PAYOUT_ENCRYPTION_KEYS` on each application environment. The selected key must decode to 32 bytes. Keep older key versions available for existing encrypted accounts; never generate a replacement for missing historical key material. Secrets belong in deployment configuration, not source control or chat.
3. The fixed policy is activated by the migration. There is no Admin setup step or editable policy form.
4. Unversioned reports use the fixed policy after migration; historical captured timing and already-paid records remain intact. TEST/UNKNOWN sources remain ineligible.
5. Review genuine PayOS reconciliation and verify Agency/bank details. Agency then requests withdrawal; Admin transfers manually and attaches evidence. Do not mark a transfer complete before checking the bank outcome.
6. Ensure the backend maintenance scheduler stays running. The dashboard shows the last successful sweep and allows another eligibility check. Retry does not override policy, source, hold, bank or dispute checks.

The local ignored environment has a bank-encryption key configured. Deployment environments must separately retain their own correct key material. Applying a migration does not configure a deployed server's secrets or activate its settlement policy.

## Access and integrity

- OWNER receives finance view/export/reconcile/bank-management and the new finance-withdraw capability. ACCOUNTANT does not receive withdrawal authority by default. Custom roles may explicitly grant it. Member grants are checked again under the Agency lock before money mutations.
- Super Admin handles internal finance; Moderator has no financial authority. Bank inspection and private proof downloads are scoped and audited. Responses mask account numbers unless using the explicit audited bank view.
- VND uses BigInt in storage and integer strings in JSON. Journal entries balance and committed journals, policy versions, allocations and audit evidence are protected against rewriting. Policy edits use optimistic version checks; money movements use transactional locks and idempotency keys.
- Proofs accept private PNG/JPEG/PDF files up to 5 MB, stored with hashes. They are not public Cloudinary links.
- Financial reports use consistent journal snapshots and Vietnam calendar ranges. Agency opening/closing liability totals include all four wallet accounts, so internal settlement/reservation movements do not falsely appear as bank payments. Excel preserves integer precision; global and Agency reports support Excel/PDF with Vietnamese fonts. Agency exports are capped at 10,000 transactions.

## Deferred scope

Accounting refunds remain unavailable: no refund tab, manual intake or approval workflow. Corresponding endpoints return HTTP 501 `FINANCE_REFUNDS_NOT_IMPLEMENTED`. Historical refund records and unresolved cancellation obligations remain intact and may block settlement. Retained internal refund functions are historical infrastructure, not a released refund feature.

Automatic bank transfers, tax accounting/invoices, voucher sponsorship accounting, guide payouts, bank fees, prior-period chart comparison and full monetary policy simulations are outside this release. TEST data is visible for inspection but cannot fund withdrawals. Tests simulate verified payment providers in isolated databases; they do not demonstrate that a real bank transfer occurred.

## Verification

`finance.integration.test.ts` exercises migrations and actual PostgreSQL transactions: double-entry invariants, source separation, immutable timing, concurrent reservations, tenant/permission checks, manual holds, bank changes, transfer proof, idempotency, legacy payouts and export totals. Frontend tests cover Agency and Admin screens and policy interactions. Build/type checks complement these tests; production smoke checks must remain read-only unless an operator explicitly initiates a financial action.
