# Legacy cart data layer

Cart UI components and their exports have been removed. Do not add cart buttons or links to the application. The legacy `/traveler/cart` route redirects to `/tours`; booking starts directly from a selected tour departure.

The API, types and hook remain for compatibility with the existing backend. Shared money/date formatting lives in `frontend/lib/travel-format.ts` so active screens do not import this feature.
