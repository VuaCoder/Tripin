import { guestTotal, type GuestCounts } from '@travel-platform/constants';

type SearchParams = Pick<URLSearchParams, 'get'>;

export function readSearchGuests(params?: SearchParams | null): GuestCounts {
  if (!params) return { adults: 1, children: 0, infants: 0 };
  const count = (key: string, fallback = 0) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 && value <= 50 ? value : fallback;
  };
  const hasGroups = ['adults', 'children', 'infants'].some(key => params.get(key) !== null);
  const guests = hasGroups
    ? { adults: Math.max(1, count('adults', 1)), children: count('children'), infants: count('infants') }
    : { adults: Math.max(1, count('guests', 1)), children: 0, infants: 0 };
  return guestTotal(guests) <= 50 ? guests : { adults: 1, children: 0, infants: 0 };
}

export function guestSearchParams(guests: GuestCounts): URLSearchParams {
  return new URLSearchParams({
    guests: String(guestTotal(guests)),
    adults: String(guests.adults),
    children: String(guests.children),
    infants: String(guests.infants),
  });
}

export function tourDetailHref(tourId: string, params: SearchParams): string {
  const next = new URLSearchParams();
  if (['guests', 'adults', 'children', 'infants'].some(key => params.get(key) !== null)) {
    guestSearchParams(readSearchGuests(params)).forEach((value, key) => next.set(key, value));
  }
  for (const key of ['departureFrom', 'departureTo']) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return `/tours/${tourId}${next.size ? `?${next}` : ''}`;
}
