# Moderator demo on the selected Neon development database

The demo rows are marked `[DEMO-MOD]`. Run `pnpm.cmd --filter backend seed:moderator-demo --expected-host=<DATABASE_URL hostname>` only against the intended non-production database. The script checks the exact hostname, creates all related rows in one transaction, and refuses to run again if its accounts already exist. It generates one password for all five accounts and prints it once; store it securely outside the repository.

| Account | Role | Demo action |
| --- | --- | --- |
| `moderator@demo-moderator.tripri.test` | MODERATOR | `/moderator`: approve/reject tours, verify agency, moderate reviews and reports, answer support, resolve escalated complaint |
| `agency@demo-moderator.tripri.test` | AGENCY, OWNER of verified agency | See owned tours and the complaint; respond as the agency |
| `pending-agency@demo-moderator.tripri.test` | AGENCY, OWNER of pending agency | See profile verification outcome and resubmit if more information is requested |
| `traveler@demo-moderator.tripri.test` | TRAVELER | See own reports and support ticket; receive moderator outcomes |
| `review-author@demo-moderator.tripri.test` | TRAVELER | See own completed booking, review and escalated complaint; use as account-ban target last |

Suggested order: sign in as moderator and inspect dashboard; decide the two pending tours; review the pending agency; hide the one-star review; inspect the TOUR, REVIEW and USER reports; reply to the open support ticket; resolve the escalated complaint. Switch to the agency and traveler accounts to show each side's result. Ban the review author only at the end, because it prevents that account from signing in afterward.

The demo includes two pending tours, two approved tours, a verified and a pending agency, one completed historical booking tied to a review and complaint, three open reports with distinct targets, one open support ticket, and one escalated complaint with traveler and agency messages. The approved review tour also has a future departure for public browsing. All rows are isolated from existing accounts and tours.
