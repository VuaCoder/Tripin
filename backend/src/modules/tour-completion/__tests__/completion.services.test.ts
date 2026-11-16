import { describe, expect, it } from 'vitest';
import { bookedCompletionServices } from '../completion.services';

describe('booked add-on aggregation', () => {
  it('groups checkout terms without merging different purchased versions or exposing passengers', () => {
    const extra = { serviceId: 'meal', name: 'Suất ăn thêm', unit: 'suất', quantity: 2, terms: 'v1', participants: ['private'] };
    const result = bookedCompletionServices([{ serviceSnapshot: [extra, { ...extra, quantity: 1 }] }, { serviceSnapshot: [extra, { ...extra, terms: 'v2' }] }]);
    expect(result).toHaveLength(2);
    expect(result.find(s => s.quantity === 5)).toMatchObject({ name: extra.name, bookingCount: 2 });
    expect(result.find(s => s.quantity === 2)).toMatchObject({ bookingCount: 1 });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('handles empty and older snapshots without inventing generic services', () => {
    expect(bookedCompletionServices([{ serviceSnapshot: [] }, { serviceSnapshot: null }, { serviceSnapshot: [null, { name: 'invalid' }] }])).toEqual([]);
  });
});
