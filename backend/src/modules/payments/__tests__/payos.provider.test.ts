import { afterEach, describe, expect, it, vi } from 'vitest';
import { hmacSha256 } from '../../../utils/crypto';
import { PayosProvider, canonicalize } from '../providers/payos.provider';

const credentials = { clientId: 'cid', apiKey: 'key', checksumKey: 'checksum-secret' };

function signedWebhook(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { code: '00', desc: 'success', success: true, data, signature: hmacSha256(credentials.checksumKey, canonicalize(data)), ...extra };
}

const data = { orderCode: 1759000000123, amount: 2_000_000, description: 'TRP-ABCD2345', paymentLinkId: 'abc', code: '00', desc: 'ok', reference: 'TF1', counterAccountName: null };

afterEach(() => vi.unstubAllGlobals());

describe('canonicalize', () => {
  it('sorts keys and turns null/undefined into empty strings', () => {
    expect(canonicalize({ b: 2, a: 'x', c: null, d: undefined, e: 'null' })).toBe('a=x&b=2&c=&d=&e=');
  });
});

describe('PayosProvider.verifyWebhook', () => {
  const provider = new PayosProvider(credentials);

  it('accepts a correctly signed successful payment', () => {
    expect(provider.verifyWebhook(signedWebhook(data))).toMatchObject({ orderCode: 1759000000123, amount: 2_000_000, success: true, reference: 'TF1' });
  });

  it('rejects a tampered amount (signature no longer matches)', () => {
    const webhook = signedWebhook(data);
    (webhook.data as Record<string, unknown>).amount = 1;
    expect(() => provider.verifyWebhook(webhook)).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });

  it('rejects a payload signed with another key', () => {
    const forged = { ...signedWebhook(data), signature: hmacSha256('other-key', canonicalize(data)) };
    expect(() => provider.verifyWebhook(forged)).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });

  it.each([null, {}, { data: {} }, { data, signature: 123 }, 'text'])('rejects malformed payload %#', (payload) => {
    expect(() => provider.verifyWebhook(payload)).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });

  it('does not treat a non-success event as a payment', () => {
    const failed = signedWebhook({ ...data, code: '01' });
    expect(provider.verifyWebhook(failed).success).toBe(false);
    expect(provider.verifyWebhook(signedWebhook(data, { success: false })).success).toBe(false);
  });

  it('refuses everything when credentials are missing', () => {
    expect(() => new PayosProvider(undefined).verifyWebhook(signedWebhook(data))).toThrowError(expect.objectContaining({ statusCode: 503 }));
  });
});

describe('PayosProvider.createPaymentLink', () => {
  const input = {
    orderCode: 123,
    amount: 5000,
    description: 'TRP-ABCD2345',
    returnUrl: 'https://app/ok',
    cancelUrl: 'https://app/no',
    expiresAt: new Date('2026-10-02T01:00:00Z'),
  };

  it('signs the request with the documented field order and returns the checkout url', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ code: '00', desc: 'success', data: { paymentLinkId: 'pl1', checkoutUrl: 'https://pay.payos.vn/web/pl1' } }) }));
    vi.stubGlobal('fetch', fetchMock);

    const link = await new PayosProvider(credentials).createPaymentLink(input);
    expect(link).toEqual({ providerPaymentLinkId: 'pl1', checkoutUrl: 'https://pay.payos.vn/web/pl1' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api-merchant.payos.vn/v2/payment-requests');
    expect(init.headers['x-client-id']).toBe('cid');
    const body = JSON.parse(init.body);
    expect(body.signature).toBe(
      hmacSha256('checksum-secret', 'amount=5000&cancelUrl=https://app/no&description=TRP-ABCD2345&orderCode=123&returnUrl=https://app/ok'),
    );
    expect(body.expiredAt).toBe(Math.floor(input.expiresAt.getTime() / 1000));
  });

  it('reports a gateway rejection or outage as 503 without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ code: '231', desc: 'order exists' }) })));
    await expect(new PayosProvider(credentials).createPaymentLink(input)).rejects.toMatchObject({ statusCode: 503 });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNRESET'))));
    await expect(new PayosProvider(credentials).createPaymentLink(input)).rejects.toMatchObject({ statusCode: 503 });
  });
});
