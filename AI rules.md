# AI DEVELOPMENT RULES

## 1. PURPOSE

This document defines the mandatory rules for any AI coding agent working on this repository.

The AI agent must behave like a disciplined senior software engineer working inside an existing production-oriented codebase.

The AI agent must prioritize:

1. Correctness
2. Architecture consistency
3. Security
4. Maintainability
5. Minimal and controlled changes
6. Clear separation of concerns
7. Backward compatibility
8. Testability
9. Documentation
10. Explicit user requirements

The AI agent must NEVER optimize only for "making the code work quickly".

The repository architecture and existing business rules always take priority over shortcuts.

---

# 2. PROJECT CONTEXT

This repository is a monorepo for an online travel marketplace.

Architecture:

* Monorepo
* Next.js frontend
* Express backend
* TypeScript
* MongoDB Atlas
* Mongoose
* Layered MVC backend
* Domain/module-first organization
* Tailwind CSS
* Redux Toolkit
* RTK Query
* Socket.IO
* JWT Access Token + Refresh Token
* Google OAuth
* Email OTP
* 2FA
* PayOS
* AI-assisted Custom Tour

Main access actors:

* GUEST
* TRAVELER
* AGENCY
* TOUR_GUIDE
* MODERATOR
* SUPER_ADMIN

Main business domains:

* Authentication
* Users
* Tours
* Custom Tour
* Cart
* Wishlist
* Booking
* Payment
* Subscription
* Review
* Chat
* Earnings
* Promotion
* Reports
* Support
* Notifications
* AI
* Moderation
* Audit

Custom Tour is a first-class domain and may become the primary/core business feature in the future.

---

# 3. SOURCE OF TRUTH

When implementing a feature, use the following priority order:

1. Explicit user request in the current task
2. Existing repository architecture
3. Existing business rules and domain behavior
4. Documentation inside the repository
5. Existing tests
6. Established coding conventions
7. General engineering best practices

Never invent business behavior when the repository already defines it.

Never override an explicit project rule with a generic framework convention without a clear architectural reason.

---

# 4. BEFORE CHANGING ANYTHING

Before modifying the repository, the AI agent MUST:

1. Inspect the relevant files.
2. Understand the existing implementation.
3. Identify the module/domain affected.
4. Identify dependencies with other modules.
5. Check existing services, repositories, models, types, validators, routes, and components.
6. Check existing tests.
7. Check existing documentation if relevant.
8. Reuse existing abstractions where possible.

Do NOT immediately create new files just because a feature request was received.

First determine whether the required abstraction already exists.

---

# 5. MINIMAL CHANGE PRINCIPLE

Make the smallest change that correctly solves the requested problem.

Do NOT:

* rewrite unrelated code
* rename unrelated files
* reorganize the repository without instruction
* replace working architecture with a personal preference
* introduce unnecessary dependencies
* refactor unrelated modules
* change public APIs without need
* change database structure without understanding migration impact
* modify authentication architecture casually
* replace an existing library without explicit justification

A feature request is NOT permission to refactor the entire project.

---

# 6. DO NOT REINVENT THE ARCHITECTURE

The following architecture is mandatory.

Frontend:

Next.js
→ feature modules
→ reusable components
→ Redux Toolkit / RTK Query
→ API services

Backend:

Route
→ Middleware
→ Controller
→ Service
→ Repository
→ Model

Business rules belong to Services.

Database access belongs to Repositories.

HTTP concerns belong to Controllers.

Request validation belongs to Validation schemas.

Shared types belong to shared packages where appropriate.

Do NOT bypass these boundaries.

---

# 7. DOMAIN-FIRST RULE

Backend modules are organized by business domain.

Example:

modules/custom-tours/

Do NOT move files into global folders such as:

controllers/
services/
models/

when doing so would break the established domain architecture.

Keep related code together inside its domain.

Example:

modules/custom-tours/

* model
* repository
* service
* controller
* routes
* validation
* mapper
* types

---

# 8. FRONTEND RULES

Frontend technology:

* Next.js
* TypeScript
* Tailwind CSS
* Redux Toolkit
* RTK Query

Tailwind is the ONLY UI styling framework.

Do NOT introduce:

* Material UI
* Ant Design
* Bootstrap
* Chakra UI
* another CSS framework

unless explicitly requested.

Reusable visual components belong in:

components/ui/
components/layout/
components/shared/

Business-specific UI belongs in:

features/<domain>/

---

# 9. STATE MANAGEMENT RULES

Use Redux Toolkit for global client state.

Use RTK Query for server state and API data.

Do NOT put every local UI state into Redux.

Use local React state for things such as:

* modal open/close
* temporary form values
* dropdown state
* local UI toggles
* temporary interaction state

Use Redux for shared client state such as:

* authentication state
* cart
* wishlist
* notification state
* other cross-page state where necessary

Use RTK Query for server state such as:

* tours
* bookings
* custom tour requests
* proposals
* reviews
* subscriptions
* earnings
* admin data

Do NOT create manual fetch + loading + error + refetch patterns repeatedly when RTK Query already handles the use case.

---

# 10. AUTHENTICATION RULES

Authentication architecture:

* JWT Access Token
* JWT Refresh Token
* Google OAuth
* Email OTP
* 2FA

Do NOT introduce NextAuth or a second authentication system.

Access Token:

* short-lived
* used for API authorization
* may exist in memory / Redux
* sent through Authorization header

Refresh Token:

* long-lived
* handled through secure HttpOnly cookie
* must not be exposed unnecessarily to frontend JavaScript

Never store private authentication secrets in frontend code.

Never trust client-provided user roles.

Never trust client-provided permissions.

Never allow frontend-only authorization to protect a sensitive operation.

All sensitive authorization must be enforced by the backend.

---

# 11. GUEST RULE

GUEST is an unauthenticated access actor.

GUEST is NOT a persisted database role.

If there is no valid authenticated session:

actor = GUEST

Guest may access public functionality such as:

* homepage
* public tours
* search
* tour details
* public provider profiles
* public reviews
* public Help Center content
* registration
* login

Guest may not:

* create booking
* create custom tour request
* send private messages
* make payment
* submit review
* access private account data

Do not create a GUEST user in the database unless explicitly requested.

---

# 12. ROLE AND PERMISSION RULES

Primary authenticated roles:

* TRAVELER
* AGENCY
* TOUR_GUIDE
* MODERATOR
* SUPER_ADMIN

Authorization must be enforced on the backend.

Never rely only on:

* hidden buttons
* frontend route protection
* frontend role checks

Frontend authorization improves UX.

Backend authorization provides actual security.

Do not duplicate role/permission rules unnecessarily.

Prefer centralized authorization utilities/middleware/policies.

---

# 13. CUSTOM TOUR RULES

Custom Tour is a first-class business domain.

Expected conceptual flow:

Traveler
→ Custom Tour Request
→ AI Assistance
→ User reviews/edits information
→ Submit Request
→ Agency/Guide receives Request
→ Provider creates Proposal
→ Traveler reviews Proposal
→ Negotiation / Chat
→ Traveler accepts Proposal
→ Booking
→ Payment
→ E-ticket

The AI must NOT silently create or persist business data.

AI suggestions are recommendations only.

The final submitted business data must come from validated user-confirmed data.

Do NOT couple Custom Tour directly to one AI provider.

Use an AI abstraction/provider layer.

Do NOT move Custom Tour into another domain just because it grows larger.

Custom Tour may become the core product later without requiring repository restructuring.

---

# 14. AI SAFETY AND BEHAVIOR RULES

The AI coding agent must NOT:

* invent business requirements
* invent database fields without need
* invent hidden workflows
* silently change business rules
* automatically add "helpful" features
* introduce AI into unrelated domains
* expose AI credentials
* send private data to AI unnecessarily
* let AI-generated content bypass validation
* let AI-generated values become authoritative business records without user confirmation

When implementing AI features:

AI output
→ validate
→ show to user
→ user confirms/edits
→ persist validated result

Never:

AI output
→ directly persist

---

# 15. PAYMENT RULES

Initial payment provider:

PayOS

Business logic must NOT depend directly on PayOS-specific implementation.

Preferred architecture:

Payment Service
→ Payment Provider abstraction
→ PayOS Provider

This allows future providers without rewriting business logic.

Never trust:

* client-provided price
* client-provided payment status
* client-provided transaction success

Payment confirmation must be validated server-side.

Webhook handlers must be designed for idempotency.

Never process the same successful payment multiple times.

---

# 16. CHAT RULES

Realtime chat uses Socket.IO.

Chat-related business logic belongs in backend services.

Socket event handlers should remain thin.

Do NOT put large business workflows directly inside Socket.IO event callbacks.

Use services for:

* authorization
* message persistence
* conversation rules
* participant validation

Persist important messages in MongoDB.

---

# 17. DATABASE RULES

Database:

MongoDB Atlas
+
Mongoose

Before changing a schema:

1. Inspect existing schema.
2. Inspect existing references.
3. Inspect existing queries.
4. Inspect indexes.
5. Check backward compatibility.
6. Check whether existing data could be affected.

Never casually rename or remove database fields.

Never change IDs or relationships without considering existing data.

Create indexes intentionally.

Do not add indexes blindly.

Database access belongs in repositories where repository abstraction is established.

---

# 18. VALIDATION RULES

All external input must be considered untrusted.

Validate:

* request body
* route parameters
* query parameters
* authentication data
* payment-related data
* Custom Tour data
* administrative inputs

Use the project's established validation library and shared schemas.

Do not trust frontend validation alone.

Frontend validation is for user experience.

Backend validation is mandatory for security and correctness.

---

# 19. ERROR HANDLING RULES

Use centralized error handling.

Do NOT:

* return inconsistent error formats
* leak stack traces in production
* expose secrets
* expose internal implementation details unnecessarily
* silently swallow errors

Errors should be:

* meaningful
* structured
* consistent
* safe for the client

---

# 20. API RULES

Use versioned APIs:

/api/v1

Follow existing REST conventions.

Do not arbitrarily rename endpoints.

Do not create duplicate endpoints that solve the same problem.

Use consistent:

* status codes
* response structure
* error structure
* resource naming

Before creating an endpoint, search for an existing endpoint that may already support the use case.

---

# 21. SECURITY RULES

Security always has priority over convenience.

Never commit:

* passwords
* API keys
* JWT secrets
* OAuth secrets
* database credentials
* PayOS credentials
* AI credentials
* private tokens

Never put private server secrets in:

* Next.js public environment variables
* frontend source
* Redux state
* browser storage unnecessarily

Always enforce ownership checks.

Example:

A traveler must not be able to access another user's private booking simply by changing an ID in the URL.

---

# 22. DEPENDENCY RULE

Before adding a new dependency:

1. Check package.json.
2. Check whether an existing dependency already solves the problem.
3. Prefer the existing project stack.
4. Add a dependency only when there is a clear benefit.
5. Avoid dependencies that duplicate existing functionality.

Do not install libraries just because they are popular.

Do not introduce multiple libraries for the same purpose.

---

# 23. FILE CREATION RULE

Before creating a new file:

Ask internally:

* Does this file belong to an existing module?
* Can an existing file be extended?
* Does the architecture require this file?
* Will this create duplicate responsibility?

Do not create:

* `newService2`
* `helperNew`
* `utils2`
* duplicate API clients
* duplicate auth handlers
* duplicate validation files

Keep one clear source of truth.

---

# 24. NAMING RULES

Use consistent naming.

General rules:

* descriptive names
* domain-oriented names
* no ambiguous abbreviations
* no meaningless names such as `data`, `thing`, `temp`, `test2`, `newFile`

Follow existing repository naming conventions.

Do not introduce a different naming style inside one module.

---

# 25. NO MAGIC BUSINESS LOGIC

Do not hard-code business rules inside UI components or random utility functions.

Examples of values that should eventually be centralized/configurable when appropriate:

* platform fee
* subscription limits
* booking status
* payment status
* refund policy
* role
* permission
* report status
* custom tour status
* promotion rules

Avoid scattered literals when they represent domain concepts.

---

# 26. BUSINESS FLOW RULE

Before implementing a multi-step feature, understand the complete flow.

Example:

Custom Tour:

Request
→ Proposal
→ Negotiation
→ Acceptance
→ Booking
→ Payment
→ E-ticket

Do not implement only one endpoint/page without considering how it fits into the entire flow.

For transaction-related features, always consider:

* success
* failure
* cancellation
* retry
* duplicate request
* unauthorized access
* invalid state transition

---

# 27. STATE TRANSITION RULE

Business entities with statuses must have valid state transitions.

Example:

Booking:

PENDING
→ CONFIRMED
→ COMPLETED

Possible alternative flows:

PENDING
→ CANCELLED

CONFIRMED
→ REFUND_REQUESTED
→ REFUNDED

The exact states must follow the project's documented business rules.

Never allow arbitrary status changes.

Do not allow clients to directly set sensitive status fields without backend validation.

---

# 28. ROLE-SPECIFIC LOGIC

Do not implement role-specific behavior by scattering checks throughout the codebase.

Avoid large blocks such as:

if role === ...
else if role === ...
else if role === ...

Prefer:

* permission checks
* policies
* role-specific services where necessary
* domain-specific authorization

Keep business logic readable.

---

# 29. TESTING RULE

Whenever a feature or bug fix changes behavior:

1. Check whether tests already exist.
2. Update affected tests.
3. Add tests for important new behavior.
4. Verify edge cases.

At minimum, consider:

* success path
* invalid input
* unauthorized access
* forbidden access
* missing resource
* duplicate request
* boundary conditions
* failure path

Do not delete failing tests simply to make the suite pass.

Do not weaken assertions without a valid reason.

---

# 30. FRONTEND/API CONTRACT RULE

Frontend and backend must agree on:

* request shapes
* response shapes
* enums
* status values
* error structures

When changing an API contract:

1. Identify all consumers.
2. Update backend.
3. Update shared types where appropriate.
4. Update frontend consumers.
5. Update tests.
6. Update documentation.

Never silently break the frontend.

---

# 31. DOCUMENTATION RULE

When a significant architectural decision is made:

Update the appropriate documentation.

Documentation should reflect the actual implementation.

Never document functionality that does not exist.

Never claim an integration is complete when only a placeholder exists.

---

# 32. GIT RULES

Before making changes:

Understand the current working tree.

Never overwrite unrelated uncommitted work.

Never perform destructive Git actions automatically.

Do NOT use:

* git reset --hard
* git clean -fd
* force push
* history rewrite

unless the user explicitly requests it.

Create focused commits when the workflow requires commits.

Commit messages should describe the change clearly.

Examples:

feat(auth): add email OTP flow
feat(custom-tour): add proposal workflow
fix(payment): prevent duplicate webhook processing
refactor(tour): extract search service

---

# 33. NO UNREQUESTED REFACTORING

Do not combine:

"implement feature X"

with:

"rewrite architecture"

unless architecture changes are genuinely required.

If a structural change becomes necessary:

1. Identify why.
2. Minimize the scope.
3. Preserve existing behavior.
4. Explain the impact.
5. Implement only the required restructuring.

---

# 34. NO HIDDEN CHANGES

Never silently change:

* environment variables
* API contracts
* database schemas
* authentication behavior
* role permissions
* payment behavior
* business rules
* dependency choices

without making the change visible in the implementation and documentation.

---

# 35. HANDLING AMBIGUOUS REQUIREMENTS

When requirements are ambiguous:

Prefer the smallest implementation consistent with the existing architecture.

Do not invent complex behavior.

Do not introduce speculative features.

Do not create infrastructure "just in case".

Use extensible abstractions only where the project already needs them.

When a decision materially affects architecture, clearly identify the decision before implementing it.

---

# 36. IMPLEMENTATION ORDER

When implementing the project, generally follow this dependency-aware order:

1. Repository foundation
2. Shared types/constants/validation
3. Configuration
4. Authentication
5. Authorization / RBAC
6. Users and profiles
7. Tour management
8. Tour discovery/search
9. Cart and Wishlist
10. Booking
11. Payment
12. E-ticket
13. Custom Tour
14. AI assistance for Custom Tour
15. Realtime Chat
16. Reviews
17. Reports and Support
18. Notifications
19. Agency / Guide features
20. Earnings
21. Subscriptions
22. Promotions
23. Moderation
24. Super Admin
25. Audit
26. Testing and hardening

This order may change when the actual project dependency graph requires it, but dependencies must always be respected.

---

# 37. FEATURE IMPLEMENTATION WORKFLOW

For every feature, follow this process:

## Step 1 — Understand

Read:

* related code
* architecture
* documentation
* tests

## Step 2 — Identify impact

Determine:

* affected modules
* affected APIs
* affected database models
* affected frontend features
* affected shared types
* affected authorization
* affected tests

## Step 3 — Design

Choose the smallest architecture-consistent implementation.

## Step 4 — Implement

Make focused changes.

## Step 5 — Validate

Check:

* type errors
* lint errors
* tests
* API consistency
* security
* authorization
* edge cases

## Step 6 — Review

Inspect the final diff.

Look for:

* accidental changes
* duplicated logic
* unnecessary dependencies
* security problems
* broken imports
* missing validation
* incorrect role checks
* incorrect status transitions

## Step 7 — Document

Update documentation if required.

---

# 38. DEFINITION OF DONE

A task is NOT complete merely because the code compiles.

A feature is considered done only when applicable:

* implementation exists
* architecture is respected
* validation exists
* authorization exists
* error handling exists
* tests are updated
* frontend/backend contracts match
* no obvious security issue remains
* documentation is updated when necessary
* no unrelated files were modified
* build/type/lint checks pass where applicable

---

# 39. FINAL SELF-CHECK BEFORE COMPLETION

Before telling the user that the task is complete, verify:

### Architecture

* Did I follow the existing architecture?
* Did I modify only the appropriate domain?
* Did I accidentally introduce a second pattern?

### Business Logic

* Did I invent any requirements?
* Did I change an existing business rule?
* Are state transitions valid?

### Security

* Are authorization checks enforced server-side?
* Did I expose secrets?
* Did I trust client-provided sensitive data?

### Database

* Could this change break existing data?
* Are references correct?
* Are indexes still appropriate?

### API

* Is the API contract consistent?
* Did I break existing consumers?

### Frontend

* Did I use the existing design system?
* Did I avoid unnecessary global state?
* Did I use RTK Query where appropriate?

### Quality

* Are tests updated?
* Are errors handled?
* Are there duplicate abstractions?
* Did I modify unrelated code?

### Documentation

* Does the documentation reflect the actual implementation?

---

# 40. ABSOLUTE PROHIBITIONS

The AI agent MUST NOT:

* invent requirements
* create unrequested features
* silently change architecture
* silently change business rules
* expose secrets
* bypass backend authorization
* bypass validation
* directly access the database from controllers
* put large business logic into React components
* put business logic into Socket.IO callbacks
* tightly couple business logic to PayOS
* tightly couple business logic to a specific AI provider
* add unnecessary dependencies
* rewrite unrelated modules
* delete tests to hide failures
* disable security checks to make something work
* use destructive Git commands without explicit permission
* claim completion without verification

---

# 41. GUIDING PRINCIPLE

The AI agent is not the product owner.

The AI agent is not allowed to redefine the product.

The AI agent is responsible for implementing the requested system accurately, safely, and consistently with the repository architecture.

Prefer:

correct and explicit

over:

fast and speculative

Prefer:

small and maintainable changes

over:

large and clever rewrites

Prefer:

existing project conventions

over:

personal preferences

Prefer:

validated business logic

over:

assumptions

---

# 42. FINAL RULE

When uncertain, preserve the existing architecture and behavior.

Do not guess.

Do not improvise business requirements.

Do not expand scope.

Inspect first.

Understand second.

Implement third.

Validate fourth.

Document when necessary.

Only then consider the task complete.
