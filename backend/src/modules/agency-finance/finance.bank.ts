import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
export interface FinanceBankInput {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
}
function key(id: string) {
    try {
        const value = Buffer.from((JSON.parse(env.PAYOUT_ENCRYPTION_KEYS ?? '{}') as Record<string, string>)[id] ?? '', 'base64');
        if (value.length === 32)
            return value;
    }
    catch { /* fail closed */ }
    throw AppError.unavailable('Chưa cấu hình mã hóa tài khoản ngân hàng.');
}
export function encryptBank(agencyId: string, input: FinanceBankInput) {
    const keyVersion = env.PAYOUT_ENCRYPTION_KEY_ID;
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(keyVersion), nonce);
    cipher.setAAD(Buffer.from(`agency-finance:${agencyId}:${keyVersion}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]);
    return { keyVersion, last4: input.accountNumber.slice(-4), encryptedDetails: [nonce, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.') };
}
export function decryptBank(agencyId: string, stored: {
    keyVersion: string;
    encryptedDetails: string;
}): FinanceBankInput {
    try {
        const [nonce, tag, data] = stored.encryptedDetails.split('.').map(v => Buffer.from(v, 'base64'));
        const cipher = createDecipheriv('aes-256-gcm', key(stored.keyVersion), nonce!);
        cipher.setAAD(Buffer.from(`agency-finance:${agencyId}:${stored.keyVersion}`));
        cipher.setAuthTag(tag!);
        return JSON.parse(Buffer.concat([cipher.update(data!), cipher.final()]).toString('utf8'));
    }
    catch {
        throw AppError.unavailable('Không thể đọc tài khoản ngân hàng.');
    }
}
