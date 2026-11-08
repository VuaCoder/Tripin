import { describe, expect, it } from 'vitest';
import { updatePreferencesBody } from '../users.validation';
import { UsersService } from '../users.service';

const slot = (start: string, end: string, enabled = true) => ({ id: start, name: 'Free time', start, end, enabled });

describe('free-time slot validation (PROFILE-005)', () => {
  it.each(['99:99', '24:00', '12:60', '9:00', '-1:00'])('rejects invalid start time %s', (start) => {
    expect(updatePreferencesBody.safeParse({ freeTimeSlots: [slot(start, '23:59')] }).success).toBe(false);
  });
  it.each([['10:00', '10:00'], ['11:00', '10:00']])('rejects non-increasing interval %s–%s', (start, end) => {
    const result = updatePreferencesBody.safeParse({ freeTimeSlots: [slot(start!, end!)] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['freeTimeSlots', 0, 'end']);
  });
  it('rejects overlapping enabled slots even when unsorted', () => {
    expect(updatePreferencesBody.safeParse({ freeTimeSlots: [slot('10:00', '12:00'), slot('09:00', '11:00')] }).success).toBe(false);
  });
  it('allows adjacent slots, disabled overlaps and day boundaries', () => {
    expect(updatePreferencesBody.safeParse({ freeTimeSlots: [slot('00:00', '10:00'), slot('10:00', '23:59'), slot('09:00', '11:00', false)] }).success).toBe(true);
  });
  it('normalizes legacy one-digit hours when reading stored preferences', async () => {
    const service = new UsersService({ findById: async () => ({ preferences: { freeTimeSlots: [slot('9:00', '9:30')] } }) } as never);
    const preferences = await service.getPreferences('guide');
    expect(preferences.freeTimeSlots[0]).toMatchObject({ start: '09:00', end: '09:30' });
    expect(updatePreferencesBody.safeParse(preferences).success).toBe(true);
  });
});
