# Localhost performance and production preview

## Correct project

Use D:/fifa/chuyen-nganh-8/WDP302/travel-platform. The accented-directory copy is a different source tree.

## Recorded cause

The development trace observed on 2026-11-12 recorded these server durations:

| Route | Request | Compilation |
| --- | ---: | ---: |
| Start | 18.774 s | 17.775 s |
| Home | 3.587 s | 3.391 s |
| Profile | 7.562 s | 7.246 s |
| Vouchers | 1.967 s | 1.621 s |
| History | 1.903 s | 1.701 s |

Repeated History requests took 167–227 ms. These saved traces show on-demand Webpack development compilation dominating the recorded slow first navigations. They are not browser interaction timings or Web Vitals.

## Run the product locally without on-demand compilation

From the project root, keep the backend running and execute:

    pnpm preview:frontend

This builds once, then starts http://localhost:3100. To reuse a completed build:

    pnpm start:frontend:preview

To build without starting a server:

    pnpm build:frontend:preview

The equivalent direct command is node frontend/scripts/preview.mjs [build|start].

- Output is isolated in frontend/.next-preview. The development .next directory is preserved.
- The preview runs in production mode and does not hot-reload edits. Rebuild after source changes.
- Existing pnpm dev:frontend remains available for development.
- The script prints its source directory to prevent testing the wrong project copy.
- Preview still uses the existing API/environment configuration. It does not launch or change the backend.
- For flows with configured frontend redirect URLs (OAuth/payment), use the matching origin. In PowerShell, set $env:TRIPRI_PREVIEW_PORT='3000' before starting preview, after freeing that port. No redirect URLs or auth settings are changed automatically.
- Type checking and linting remain enabled. The preview TypeScript config checks application sources and generated preview route types, excluding test files and other build directories.

## Import changes

Start, Home, root layout, Header, settings routes, and account components import the same symbols directly instead of traversing feature-wide export files. Existing components, barrel exports, JSX, business logic, loaders, animation timing, and styles are preserved.

Validation records are under the ignored .test-artifacts/performance directory. A TypeScript AST comparison verified that the 19 edited TSX files' non-import statements were unchanged at edit time. Existing UI/auth work in the repository was not reverted.

Selected regression suite: 6 files, 52 tests passed (preloader, Header, ProfileSummary, VoucherWallet, HotVouchersSection).

## Measurement limits

Bundle snapshots sum unique JavaScript files referenced by each route and the root layout, with local gzip estimates; they are not a browser transfer measurement or Next.js's First Load JS column. Auth files were concurrently updated during this work, so bundle differences are descriptive and cannot be attributed solely to import changes. Server response timings must not be described as click-to-interactive timings. Authenticated account API behavior requires an authenticated browser session to measure.

## Verified result

Both preview builds completed successfully (77 generated pages), including lint and application type checking. The preview server started on port 3100. Browser smoke verification navigated from Start through the existing Khám phá ngay link to Home; no console errors/warnings were returned at that checkpoint. This was a guest session, not an authenticated account-tab test.

The Next.js build report recorded these First Load JS figures before/after:

| Route | Before | After |
| --- | ---: | ---: |
| Start | 206 kB | 171 kB |
| Home | 516 kB | 206 kB |
| Profile | 334 kB | 188 kB |
| Profile security | 334 kB | 131 kB |
| Vouchers | 331 kB | 193 kB |
| History | 477 kB | 335 kB |

These are build-reported figures, distinct from the route-plus-layout manifest union snapshots. Concurrent authentication edits limit causal attribution of exact differences.

Fresh HTTP preview measurements (three sequential requests per path, status 200 throughout):

| Route | Milliseconds |
| --- | --- |
| Start | 314, 14, 13 |
| Home | 20, 13, 12 |
| Profile | 16, 10, 15 |
| Vouchers | 20, 18, 10 |
| History | 13, 6, 7 |

These measure receipt of HTML, not authenticated API completion or perceived navigation latency. The older development trace and these preview requests use different request/cache conditions; do not turn them into a direct percentage speedup.
