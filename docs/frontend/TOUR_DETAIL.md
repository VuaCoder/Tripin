# Tour detail

The public `/tours/:id` surface follows the supplied reference: title and image mosaic, a two-column reading/booking layout, day accordions, price policies and travel guidance. It preserves Tripri's teal palette and existing header/footer. Hotline and insurance have no dedicated module or tab on this page.

The individual guidance components are `TourTravelNotes`, `TourCancellationPolicy` and `TourRequiredDocuments`; price sections are `TourIncludedServices`, `TourExcludedServices` and `TourChildPricing`. Missing commercial facts are explicitly marked as unpublished. The gallery uses actual tour images and a native modal dialog; no stock imagery is silently assigned to a real tour.

Only the selected tab is displayed: itinerary, price policies (included/excluded services and child pricing), or guidance (travel notes, cancellation and documents). Tabs support arrow keys, Home and End. The wishlist control is an icon-only heart with an accessible label. Booking goes directly to the booking form; the detail page has no cart action.

Agency editors store four independent text fields and optional `agePricing {childMinAge, adultMinAge, childPercent, infantPercent}`. Ages are measured on the departure date; ranges are infant `<childMinAge`, child `>=childMinAge && <adultMinAge`, adult `>=adultMinAge`. Tour-level structured pricing and free-form policy coexist.

Selections carry optional `guestCounts {adults,children,infants}`. Counts must sum to `participants`, include an adult, and respect available seats/the existing 50-person limit. Every guest occupies one seat. Each group's unit VND price is rounded before multiplying by the count. Legacy requests without counts remain all-adult. The backend calculates the authoritative amount; a booking stores `guestPricing` so later changes to the tour cannot reprice an existing payment.

Migration: `20261018010000_tour_detail_policies` adds nullable columns only. Existing tours and bookings remain compatible. The deployment uses the direct database connection with Prisma migrations.
