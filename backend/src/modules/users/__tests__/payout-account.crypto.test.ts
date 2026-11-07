import { describe, expect, it } from 'vitest';
import { encryptPayoutAccount, maskedPayoutAccount } from '../payout-account.crypto';
import { env } from '../../../config/env';

const account = { bankName: 'Bank', accountNumber: '0012345678', accountHolder: 'TEST GUIDE' };
describe('guide payout encryption', () => {
  it('uses randomized authenticated encryption and returns only last four digits', () => {
    const first = encryptPayoutAccount('guide1', account);
    expect(first.encryptedDetails).not.toEqual(encryptPayoutAccount('guide1', account).encryptedDetails);
    expect(maskedPayoutAccount('guide1', first)).toEqual({ ...account, accountNumber: '****5678' });
    expect(() => maskedPayoutAccount('guide2', first)).toThrow();
    expect(() => maskedPayoutAccount('guide1', { ...first, encryptedDetails: `${first.encryptedDetails}BAD` })).toThrow();
  });
  it('fails closed when encryption keys are unavailable', () => {
    const previous = env.PAYOUT_ENCRYPTION_KEYS;
    try {
      env.PAYOUT_ENCRYPTION_KEYS = undefined;
      expect(() => encryptPayoutAccount('guide', account)).toThrow('not configured');
    } finally { env.PAYOUT_ENCRYPTION_KEYS = previous; }
  });
});
