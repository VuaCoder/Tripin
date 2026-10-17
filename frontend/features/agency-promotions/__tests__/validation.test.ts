import { describe, expect, it } from 'vitest';
import { validatePromotionForm, type PromotionFormValues } from '../validation';
import { buildCreatePayload, buildUpdatePatch } from '../components/AgencyPromotionsPage';
import { toLocalInput } from '../components/PromotionFormDialog';
import type { AgencyPromotion } from '../types';

const NOW = new Date('2026-10-16T00:00:00');

const valid: PromotionFormValues = {
  code: 'he2026',
  title: 'Giảm hè',
  description: '',
  discountType: 'PERCENT',
  discountValue: '10',
  maxDiscountAmount: '',
  minOrderAmount: '',
  startsAt: '2026-11-01T08:00',
  endsAt: '2026-12-01T08:00',
  usageLimit: '',
};

describe('validatePromotionForm', () => {
  it('accepts a valid form', () => {
    expect(validatePromotionForm(valid, { mode: 'create', now: NOW })).toEqual({});
  });

  it('rejects a malformed code, only in create mode', () => {
    expect(validatePromotionForm({ ...valid, code: 'a b' }, { mode: 'create', now: NOW }).code).toBeTruthy();
    expect(validatePromotionForm({ ...valid, code: 'a b' }, { mode: 'edit', now: NOW }).code).toBeUndefined();
  });

  it('limits PERCENT to 1-100 and forbids a max cap on FIXED', () => {
    expect(validatePromotionForm({ ...valid, discountValue: '101' }, { mode: 'create', now: NOW }).discountValue).toBeTruthy();
    const fixed = validatePromotionForm({ ...valid, discountType: 'FIXED', discountValue: '50000', maxDiscountAmount: '1000' }, { mode: 'create', now: NOW });
    expect(fixed.discountValue).toBeUndefined();
    expect(fixed.maxDiscountAmount).toBeTruthy();
  });

  it('requires endsAt after startsAt and in the future for new promotions', () => {
    expect(validatePromotionForm({ ...valid, endsAt: '2026-10-01T08:00' }, { mode: 'create', now: NOW }).endsAt).toBeTruthy();
    expect(validatePromotionForm({ ...valid, startsAt: '2026-01-01T08:00', endsAt: '2026-02-01T08:00' }, { mode: 'create', now: NOW }).endsAt).toBeTruthy();
    expect(validatePromotionForm({ ...valid, startsAt: '2026-01-01T08:00', endsAt: '2026-02-01T08:00' }, { mode: 'edit', now: NOW }).endsAt).toBeUndefined();
  });

  it('rejects non-integer numbers', () => {
    expect(validatePromotionForm({ ...valid, discountValue: '1.5' }, { mode: 'create', now: NOW }).discountValue).toBeTruthy();
    expect(validatePromotionForm({ ...valid, usageLimit: '0' }, { mode: 'create', now: NOW }).usageLimit).toBeTruthy();
  });
});

describe('payload builders', () => {
  it('builds a create payload without empty optional fields and uppercases the code', () => {
    const payload = buildCreatePayload(valid);
    expect(payload).toMatchObject({ code: 'HE2026', discountType: 'PERCENT', discountValue: 10 });
    expect(payload).not.toHaveProperty('maxDiscountAmount');
    expect(payload).not.toHaveProperty('usageLimit');
    expect(payload).not.toHaveProperty('description');
    expect(payload.startsAt).toBe(new Date('2026-11-01T08:00').toISOString());
  });

  const original: AgencyPromotion = {
    id: 'p1',
    scope: 'AGENCY',
    code: 'HE2026',
    title: 'Giảm hè',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderAmount: 0,
    startsAt: new Date('2026-11-01T08:00').toISOString(),
    endsAt: new Date('2026-12-01T08:00').toISOString(),
    usedCount: 0,
    isActive: true,
    isRunning: false,
  };

  it('sends only changed fields on edit', () => {
    const values = { ...valid, minOrderAmount: '0', startsAt: toLocalInput(original.startsAt), endsAt: toLocalInput(original.endsAt), title: 'Giảm hè lớn' };
    expect(buildUpdatePatch(values, original)).toEqual({ title: 'Giảm hè lớn' });
  });

  it('never sends discountValue once the promotion has been used', () => {
    const values = { ...valid, minOrderAmount: '0', startsAt: toLocalInput(original.startsAt), endsAt: toLocalInput(original.endsAt), discountValue: '20' };
    expect(buildUpdatePatch(values, { ...original, usedCount: 3 })).toEqual({});
  });
});
