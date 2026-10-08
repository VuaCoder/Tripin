# wishlist (frontend)

Traveler's saved ("yêu thích") tours. Built **before the tour list page existed**, so it only depends on things that
are already on `main`: the backend `wishlists` module and the tour detail route `/tours/[id]`.

Backend contract: `backend/src/modules/wishlists/README.md`.

## What is here
| Piece | File | Role |
|---|---|---|
| API | `api/wishlistApi.ts` | `getWishlist` (paged), `getWishlistTourIds` (all ids, for the saved flag), `addToWishlist`, `removeFromWishlist`. All share the RTK tag `Wishlist/ME`, so add/remove refresh both queries. |
| Hook | `hooks/useTourWishlist.ts` | `{ status, isSaved, pending, error, toggle, retry }` for one tour. Only a logged-in TRAVELER hits `/wishlist`. |
| Button | `components/WishlistButton.tsx` | Heart toggle. Guest → link to `/login`; non-traveler → renders nothing. |
| Card | `components/WishlistItemCard.tsx` | One saved tour; link to `/tours/:id`; "no longer available" notice + remove when `available:false`. |
| Page | `components/WishlistPage.tsx` | Loading / error / empty / list + pagination. Route: `app/traveler/wishlist/page.tsx`. |
| Nav | `components/layout/navigation-config.ts` | "Tour yêu thích" under TRAVELER. |
| Tag | `store/api/baseApi.ts` | `Wishlist` added to `tagTypes`. |

## Already wired
* `app/tours/[id]/page.tsx` renders `<WishlistButton tourId={tour.id} />` under the price.

## For whoever builds the tour list / richer tour detail
1. **Tour list cards**: reuse the button on each card —
   `import { WishlistButton } from '@/features/wishlist'; <WishlistButton tourId={tour.id} />`.
   Every button shares one cached `getWishlistTourIds` query, so a list of N cards causes **one** request, not N.
2. **Richer tour detail**: keep (or move) `<WishlistButton>`; it only needs `tourId`.
3. The wishlist empty state links to `/tours` ("Khám phá tour"). `/tours` is still a placeholder; change the target in
   `WishlistPage.tsx` if the list lives elsewhere (nav also has `/explore`).
4. `WishlistTourCard` mirrors the backend `TourListItemDto`. If `features/tours` types become the shared source,
   replace it with `TourListItem` and delete the duplicate (same note as `features/cart/types`).
5. `formatVnd` / `formatDuration` / `formatDepartureDate` are imported from `@/features/cart`. Move them to a shared util
   when one exists.

## Behaviour notes
* Add/remove are idempotent on the backend; a double click is safe. The button is disabled while a request is pending.
* Saved state comes from the server list (no local storage), so a refresh keeps it. Each traveler only ever sees their
  own list (owner = token user; the client sends no user id).
* A tour that stops being public stays in the list as `available:false` with no card; the card shows a notice and the
  remove button only. A tour deleted outright is handled the same way.
* `WISHLIST_FULL` (200 tours) comes back as 409 and is shown under the button via `getApiErrorMessage`.
* `getWishlistTourIds` fetches pages of 100 (backend max) up to the 200 cap, so at most 2 requests.

## Tests
`__tests__/wishlistApi.test.ts`, `WishlistItemCard.test.tsx`, `WishlistButton.test.tsx`
→ `npx vitest run features/wishlist` (from `frontend/`).

## Not done
* No optimistic update (the button waits for the server, then refetches).
* No "move to cart" and no tour-list-page integration yet (see above).
