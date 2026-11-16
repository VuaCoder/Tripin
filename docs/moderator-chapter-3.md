# Chapter 3 — Moderator Functional Specification

> This chapter follows the report template: feature name, function name, Function trigger, Function description, Screen layout, screenshot, and Function Details. Replace each screenshot placeholder with an image captured from the running application.

## 3.1.5 Moderator Function List

The Moderator is responsible for reviewing content and handling platform cases. After signing in, the Moderator accesses the `/moderator` workspace. The available functions are: (1) view the moderation dashboard; (2) view tour lists and details; (3) approve or reject tours; (4) suspend tours; (5) verify agency profiles; (6) moderate reviews; (7) resolve reports and disputes; (8) adjudicate tour service complaints; (9) handle platform support tickets; and (10) ban violating accounts. Access is checked by both the interface and the API.

## 3.2 Moderation and Platform Operations

### 3.2.1 View Moderation Dashboard

- *Function trigger:* Sign in as a Moderator at `/login`, then select **Overview** in the sidebar or open `/moderator` directly.

- *Function description:* The dashboard summarizes moderation workloads and provides links to tour, agency, review, report, complaint, and support queues. Its figures are retrieved from the server and help the Moderator prioritize work.

- *Screen layout:* A navigation sidebar appears on the left. The main area contains a heading, summary cards, and links to the corresponding queues.

  [Insert Figure 3.2.1: the full `/moderator` page, including the sidebar and at least one card with data.]

- *Function Details:*

  - Only users with `moderation:dashboard` permission can view the data. The page shows a loading state while fetching and an error message with a retry option if the request fails. Figures reflect the time of the latest request and may change as cases are processed. Selecting a card opens its queue, where the required permission is checked again.

### 3.2.2 View Tour Lists and Details

- *Function trigger:* Select **Tour Review** in the sidebar to open `/moderator/tours`, then select a tour card or row.

- *Function description:* The Moderator can browse tours under review, search by tour name, destination, or agency, filter by status, and switch between grid and list views. Tour details provide the content, agency, price, itinerary, and current status needed for a decision.

- *Screen layout:* The top area contains a search field, status filter, view controls, and refresh button. Tour cards or rows appear below. Selecting one opens a detail modal.

  [Insert Figures 3.2.2a–b: the list filtered to Pending Review and the detail view of one pending tour.]

- *Function Details:*

  - Results are paginated. Available status filters include `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`, `DRAFT`, and `ARCHIVED`. An empty result displays an empty state. Query failures and permission errors display errors rather than an empty list. Viewing all tours requires `tour:list-all`; making decisions requires the corresponding action permission.

### 3.2.3 Approve or Reject a Tour

- *Function trigger:* On `/moderator/tours`, open a tour with **Pending Review** status and select **Approve** or **Reject**.

- *Function description:* The Moderator checks the tour information and agency before deciding. Approval changes the tour to `APPROVED`. Rejection changes it to `REJECTED` and records a reason for the agency.

- *Screen layout:* The tour detail modal displays the tour information and decision buttons. Rejecting opens a confirmation dialog with a reason field.

  [Insert Figures 3.2.3a–c: the pending tour, rejection dialog with a reason, and the resulting status.]

- *Function Details:*

  - `POST /moderation/tours/:id/validate` accepts an approval flag and an optional reason. Rejection requires a reason of 3–1,000 characters after trimming whitespace; approval may omit it. A decision is allowed only when the tour is in an eligible state. If another Moderator has already processed it, the system returns a conflict or invalid state error and the page must be refreshed. A success message is shown only after the server confirms the decision. The agency receives the result through the platform notification flow.

### 3.2.4 Suspend a Tour

- *Function trigger:* On `/moderator/tours`, filter to **Approved**, open a tour, and select **Suspend**.

- *Function description:* The Moderator stops an approved tour from being sold publicly when a concern requires investigation, such as a safety report or unsuitable content.

- *Screen layout:* The detail view shows the approved status and Suspend action. A dialog requests confirmation and a reason.

  [Insert Figures 3.2.4a–b: the suspension dialog and the tour marked Suspended.]

- *Function Details:*

  - `POST /moderation/tours/:id/suspend` requires a reason of 3–1,000 characters. Only an eligible approved tour can be suspended. On success, its status becomes `SUSPENDED`, it is no longer offered in the public sales list, and the reason is retained for auditing. Empty reasons, insufficient permissions, changed tour status, and network failures must be reported without showing a false success state.

### 3.2.5 Verify an Agency Profile

- *Function trigger:* Select **Agency Verification** in the sidebar, open `/moderator/agencies`, filter to **Pending**, and select **View and Process**.

- *Function description:* The Moderator checks the company name, representative, address, business license or supporting documents, and submission date. Available decisions are approval, rejection, and a request for additional information. An agency may submit a tour for review only after its profile is verified.

- *Screen layout:* The agency list offers a status filter and grid/list controls. The detail modal shows registration information, documents, and decision buttons.

  [Insert Figures 3.2.5a–c: a pending agency, its detail and information request, and the updated status.]

- *Function Details:*

  - `POST /moderation/agencies/:id/verify` records the decision. Approval changes the status to `VERIFIED`. Requesting information changes it to `INFORMATION_REQUESTED`; the agency can update and resubmit its profile, returning it to `PENDING`. Rejection records the rejected state. Rejection and information requests require a note of 3–1,000 characters; approval may omit it. If two Moderators process the same profile, only the first valid decision succeeds. The second receives a conflict and must reload the record.

### 3.2.6 Moderate Reviews

- *Function trigger:* Select **Review Moderation** to open `/moderator/reviews`, then open a review or the reported reviews tab.

- *Function description:* The Moderator examines the rating, comment, author, and related tour. A violating review can be hidden; a hidden review can be restored. The reported reviews tab helps investigate complaints about reviews. Changing review visibility and closing a report are separate decisions.

- *Screen layout:* The page includes search, status and star rating filters, tabs, and review entries. The detail view shows the review content, images, status, and actions.

  [Insert Figures 3.2.6a–c: the review list or reported tab, a hide decision with a reason, and the resulting status.]

- *Function Details:*

  - Changing `VISIBLE` to `HIDDEN` requires a reason of 3–1,000 characters. Restoring `HIDDEN` to `VISIBLE` requires a restoration reason of the same length. The decision includes a `contentVersion` so the server can reject a stale decision if the content changed. Hidden reviews disappear from public views and affect the tour rating as processed by the backend. The author can still view their review and the hiding reason. Hiding a review does not automatically close related reports.

### 3.2.7 Resolve Reports and Disputes

- *Function trigger:* Select **Violation Reports** to open `/moderator/reports`. Filter by status, target type (`TOUR`, `REVIEW`, or `USER`), or category, then open a report. Traveler reports and agency review disputes enter this queue.

- *Function description:* The Moderator reviews the reporter, reported target, related agency and tour, description, status, and available evidence. After investigation, the Moderator resolves or rejects the report and provides a note. For a review report, the review can also be hidden or restored through a separate action.

- *Screen layout:* A list with search and filters leads to a detail dialog showing the parties, report description, note field, and decision buttons.

  [Insert Figures 3.2.7a–c: the report queue, one report detail, and its final status with the note visible to the reporter.]

- *Function Details:*

  - `POST /moderation/reports/:id/resolve` accepts `RESOLVED` or `REJECTED` and requires a note of 3–2,000 characters. A closed report is final and cannot be decided again. Resolving a tour report does not automatically suspend the tour; resolving a user report does not automatically ban the account. Hiding or restoring a review likewise does not close its report. The reporter sees the outcome at `/settings/reports`; an agency follows its own review dispute in the agency area. Empty, loading, error, and permission states must be handled.

### 3.2.8 Adjudicate Tour Service Complaints

- *Function trigger:* Select **Tour Service Complaints** to open `/moderator/complaints`, then open an escalated ticket.

- *Function description:* This function handles disputes between a traveler and an agency about a tour service. The Moderator reviews the tour, both parties, conversation history, evidence, and priority; they can send messages and issue an adjudication.

- *Screen layout:* The page contains complaint or quality summaries, ticket tabs or filters, and a conversation detail view.

  [Insert Figures 3.2.8a–c: the escalated complaint list, conversation and evidence, and adjudication result.]

- *Function Details:*

  - A ticket must be in an eligible state before adjudication. The Moderator records a clear decision and reason. On success, the ticket leaves the escalated queue and the parties can view the outcome. Images and other evidence are shown only when present. If another user has already processed the ticket, or if permission, data, or network errors occur, the Moderator must reload before deciding again. This workflow is distinct from platform support tickets.

### 3.2.9 Handle Platform Support Tickets

- *Function trigger:* Select **Platform Support Requests** to open `/moderator/support-tickets`, filter by status or category, and open a ticket.

- *Function description:* The Moderator responds to user requests directed to the platform. They view the conversation, reply, move the ticket to `IN_PROGRESS`, or mark it `RESOLVED`. This is a support workflow rather than tour dispute adjudication.

- *Screen layout:* The list shows each ticket's status, category, sender, and view action. The detail view contains message history, a reply field, and status actions.

  [Insert Figures 3.2.9a–c: the ticket list, a reply in the detail view, and the resolved status.]

- *Function Details:*

  - A reply must contain 2–4,000 characters after trimming. A separate status change to `RESOLVED` requires a resolution note of 10–2,000 characters. Tickets follow `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`; a message from the owner can reopen a resolved ticket. After a successful reply or status change, the result must remain after reloading. Empty messages, duplicate submissions while saving, insufficient permissions, missing tickets, and network failures must be handled.

### 3.2.10 Ban a Violating Account

- *Function trigger:* From a review or report associated with a user, select **Ban Account** after verifying the violation.

- *Function description:* The Moderator prevents a violating user from continuing to use the platform. The decision identifies the target account and records the reason. If initiated from a visible review, hiding that review is a separate moderation action.

- *Screen layout:* The target detail view shows the user's name and ban action. A confirmation dialog explains the action and captures the reason.

  [Insert Figures 3.2.10a–c: the target and Ban Account button, confirmation dialog, and blocked account or login state.]

- *Function Details:*

  - `POST /moderation/users/:id/ban` requires a reason of 3–1,000 characters. A successful decision changes the account status to `BANNED`; a subsequent login returns `ACCOUNT_BANNED`, and an existing session is blocked on its next request. Missing, already banned, or unauthorized accounts cannot be processed. Banning an account and hiding its review are separate operations; both results should be checked. Unbanning is reserved for the Super Admin.

## Screenshot Capture Guide

1. **Prepare isolated test data.** Follow [`docs/testing/moderator/README.md`](testing/moderator/README.md) to start a temporary local PostgreSQL instance, seed it, create the `[QA-MOD]` fixture, and run the backend and frontend against that local database. Before any migration or fixture command, verify that `DATABASE_URL` points to `localhost` or `127.0.0.1`. The fixture supplies Moderator, agency, traveler, and violating user accounts. Do not put passwords in the report.
2. **Use one consistent frame.** Set the desktop browser to approximately 1440 × 900 at 100% zoom, leave the sidebar expanded, and wait for loading to finish. Capture a consistent window or content region. Include the heading, filters, relevant record, actions, and result where possible. Use Win+Shift+S or the browser's screenshot feature.
3. **Capture before, during, and after.** For each decision, capture the list before processing, the detail or decision dialog with valid data, and the success state. Reload once to confirm the result persists. Include one validation error, such as a missing reason, if the report requires abnormal case evidence.
4. **Match records to functions.** Use the fixture's separate `APPROVE`, `REJECT`, and `SUSPEND` tours for the three tour decisions; the `PENDING` agency for verification; the one-star review for review moderation; `TOUR`, `REVIEW`, and `USER` reports for report filters; the `ESCALATED` ticket for tour complaints; and the `OPEN` ticket for platform support. To repeat a state-changing scenario, create a new temporary local database as described in the QA guide.
5. **Name and caption images.** Save images under `docs/moderator-report-images/` as `3-2-01-dashboard.png`, `3-2-02-tours-list.png`, `3-2-03-tour-decision.png`, `3-2-04-tour-suspended.png`, `3-2-05-agency-verification.png`, `3-2-06-review-moderation.png`, `3-2-07-report-resolution.png`, `3-2-08-tour-complaint.png`, `3-2-09-support-ticket.png`, and `3-2-10-account-ban.png`. In Word, place each image immediately after its *Screen layout* paragraph and add a caption such as “Figure 3.2.3b — Reject Tour dialog.”
6. **Check the submission.** Compare every image with its function, URL, before/after status, and caption. Mask real email addresses, phone numbers, license numbers, tokens, or other sensitive details if the screenshots come from a non-fixture environment. Existing images in `docs/testing/reports/` are reference evidence for some older screens; capture new ones if the current interface differs.

## Repository References

- Use case list: `docs/use-cases/README.md`; API mapping: `docs/backend/USE_CASE_MAP.md`.
- QA data and step-by-step walkthrough: `docs/testing/moderator/README.md`.
- Current pages and actions: `frontend/app/moderator/`, `frontend/features/moderation/components/`, and `frontend/features/complaints/`.
- API validation and routes: `backend/src/modules/moderation/moderation.validation.ts` and `backend/src/modules/moderation/moderation.routes.ts`.
