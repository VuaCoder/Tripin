import { createHash } from 'node:crypto';

/** Only booked add-ons, using checkout terms rather than the editable tour catalog. No passenger details. */
export function bookedCompletionServices(bookings: { serviceSnapshot: unknown }[]) {
  const grouped = new Map<string, { key: string; serviceId: string; name: string; unit: string; quantity: number; bookingCount: number }>();
  for (const booking of bookings) {
    const seen = new Set<string>();
    for (const value of Array.isArray(booking.serviceSnapshot) ? booking.serviceSnapshot : []) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      if (typeof item.serviceId !== 'string' || typeof item.name !== 'string' || !Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0) continue;
      const unit = typeof item.unit === 'string' ? item.unit : '';
      const key = createHash('sha256').update(JSON.stringify([item.serviceId, item.name, unit, item.terms ?? null])).digest('hex');
      const group = grouped.get(key) ?? { key, serviceId: item.serviceId, name: item.name, unit, quantity: 0, bookingCount: 0 };
      group.quantity += Number(item.quantity);
      if (!seen.has(key)) group.bookingCount++;
      seen.add(key);
      grouped.set(key, group);
    }
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.key.localeCompare(b.key));
}
