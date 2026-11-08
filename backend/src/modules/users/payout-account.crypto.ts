import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import type { BankAccountDto as BankAccount } from './users.types';

function keyFor(id: string): Buffer {
  try {
    const keys = JSON.parse(env.PAYOUT_ENCRYPTION_KEYS ?? '{}') as Record<string, string>;
    const key = Buffer.from(keys[id] ?? '', 'base64');
    if (key.length === 32) return key;
  } catch { /* Fail closed; never fall back to JWT or a default encryption key. */ }
  throw new AppError(503, 'PAYOUT_NOT_CONFIGURED', 'Payout account encryption is not configured');
}

export function encryptPayoutAccount(guideId: string, account: BankAccount) {
  const keyVersion = env.PAYOUT_ENCRYPTION_KEY_ID;
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(keyVersion), nonce);
  cipher.setAAD(Buffer.from(`guide-payout:${guideId}:${keyVersion}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(account), 'utf8'), cipher.final()]);
  return {
    keyVersion, last4: account.accountNumber.slice(-4),
    encryptedDetails: [nonce, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.'),
  };
}

export function maskedPayoutAccount(guideId: string, stored: { keyVersion: string; encryptedDetails: string }): BankAccount {
  const key = keyFor(stored.keyVersion);
  try {
    const encoded = stored.encryptedDetails.split('.');
    const parts = encoded.map((part) => Buffer.from(part, 'base64'));
    if (parts.length !== 3) throw new Error('Invalid envelope');
    if (parts.some((part, index) => part.toString('base64') !== encoded[index]) || parts[0]!.length !== 12 || parts[1]!.length !== 16) throw new Error('Invalid envelope');
    const decipher = createDecipheriv('aes-256-gcm', key, parts[0]!);
    decipher.setAAD(Buffer.from(`guide-payout:${guideId}:${stored.keyVersion}`));
    decipher.setAuthTag(parts[1]!);
    const account = JSON.parse(Buffer.concat([decipher.update(parts[2]!), decipher.final()]).toString('utf8')) as BankAccount;
    return { bankName: account.bankName, accountHolder: account.accountHolder, accountNumber: `****${account.accountNumber.slice(-4)}` };
  } catch {
    throw new AppError(503, 'PAYOUT_ACCOUNT_UNAVAILABLE', 'Payout account details are unavailable');
  }
}
