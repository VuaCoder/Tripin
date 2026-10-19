import { describe, expect, it } from 'vitest';
import { commissionValue, categoryError, policyError } from '../validation';
import { validatePromotionForm } from '@/features/promotions/validation';
import { valuesFromPromotion } from '@/features/promotions/PromotionFormDialog';
import { buildUpdatePatch } from '@/features/promotions/payload';
import { policy, promotion } from './fixtures';

describe('admin configuration boundaries', () => {
  it.each(['', ' ', '-1', '101', '12.345', 'NaN', '1e1'])('refuses invalid commission %s', (raw) => expect(commissionValue(raw)).toBeNull());
  it.each([['0', 0], ['100', 100], ['12.50', 12.5]] as const)('accepts commission %s', (raw, n) => expect(commissionValue(raw)).toBe(n));
  it('validates category name/slug/order boundaries', () => {
    expect(categoryError('Đà Nẵng', '', '0')).toBeNull();
    for (const args of [['X', '', '0'], ['!!', '', '0'], ['Beach', '', ''], ['Beach', '', '1.5'], ['Beach', '', '-1'], ['Beach', '', '100001']]) expect(categoryError(...args as [string, string, string])).toBeTruthy();
  });
  it('validates the policy key-specific knob and typed parameter limits', () => {
    expect(policyError('cancellation', policy)).toBeNull();
    for (const hours of [-1, '24', true, Infinity]) expect(policyError('cancellation', { ...policy, params: { cancellationWindowHours: hours } })).toBeTruthy();
    expect(policyError('cancellation', { ...policy, params: { cancellationWindowHours: 0.5 } })).toBeNull();
    expect(policyError('terms', { ...policy, params: { 'bad key': true } })).toBeTruthy();
    expect(policyError('terms', { ...policy, params: { note: 'x'.repeat(501) } })).toBeTruthy();
  });
  it('prevents pretending to clear persisted promotion limits and enforces usedCount', () => {
    const values = valuesFromPromotion(promotion);
    expect(validatePromotionForm({ ...values, usageLimit: '1' }, { mode: 'edit', original: promotion }).usageLimit).toBeTruthy();
    expect(validatePromotionForm({ ...values, usageLimit: '' }, { mode: 'edit', original: promotion }).usageLimit).toBeTruthy();
    expect(buildUpdatePatch({ ...values, description: '' }, { ...promotion, description: 'Old' })).toEqual({ description: '' });
  });
});
