import { env } from '../../../config/env';
import { AppError } from '../../../utils/app-error';
import { hmacSha256, safeEqual } from '../../../utils/crypto';
import { logger } from '../../../utils/logger';
import type {
  CreatePaymentLinkInput,
  PaymentLink,
  PaymentProvider,
  ProviderPaymentStatus,
  VerifiedWebhook,
} from './payment.provider';

const API_BASE = 'https://api-merchant.payos.vn';
const REQUEST_TIMEOUT_MS = 15_000;

interface PayosCredentials {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

/**
 * PayOS implementation over plain REST + HMAC-SHA256 (no SDK dependency, DECISIONS D-21).
 * Signature recipes (PayOS docs):
 *  - create link:  HMAC(checksumKey, "amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=..")
 *  - webhook:      HMAC(checksumKey, every `data` field as key=value, keys sorted alphabetically, joined with "&")
 */
export class PayosProvider implements PaymentProvider {
  readonly name = 'PAYOS';

  constructor(private readonly credentials?: PayosCredentials) {}

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
    const credentials = this.requireCredentials();
    const signature = hmacSha256(
      credentials.checksumKey,
      `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`,
    );
    const response = await this.request<{ code: string; desc: string; data?: { paymentLinkId: string; checkoutUrl: string } }>(
      'POST',
      '/v2/payment-requests',
      {
        orderCode: input.orderCode,
        amount: input.amount,
        description: input.description,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        expiredAt: Math.floor(input.expiresAt.getTime() / 1000),
        signature,
      },
    );
    if (response.code !== '00' || !response.data) {
      logger.error('PayOS rejected the payment link request', { code: response.code, desc: response.desc });
      throw AppError.unavailable('The payment provider could not create the payment link');
    }
    return { providerPaymentLinkId: response.data.paymentLinkId, checkoutUrl: response.data.checkoutUrl };
  }

  verifyWebhook(payload: unknown): VerifiedWebhook {
    const credentials = this.requireCredentials();
    const body = payload as { code?: string; success?: boolean; data?: Record<string, unknown>; signature?: string } | null;
    if (!body || typeof body !== 'object' || !body.data || typeof body.signature !== 'string') {
      throw AppError.badRequest('Malformed webhook payload');
    }
    const expected = hmacSha256(credentials.checksumKey, canonicalize(body.data));
    if (!safeEqual(expected, body.signature.toLowerCase())) {
      throw AppError.badRequest('Invalid webhook signature');
    }
    const orderCode = Number(body.data.orderCode);
    const amount = Number(body.data.amount);
    if (!Number.isSafeInteger(orderCode) || !Number.isSafeInteger(amount)) {
      throw AppError.badRequest('Malformed webhook payload');
    }
    return {
      orderCode,
      amount,
      paymentLinkId: typeof body.data.paymentLinkId === 'string' ? body.data.paymentLinkId : undefined,
      success: body.success === true && body.code === '00' && body.data.code === '00',
      reference: typeof body.data.reference === 'string' ? body.data.reference : undefined,
    };
  }

  async getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus> {
    const response = await this.request<{ code: string; data?: { status?: string; amountPaid?: number } }>(
      'GET',
      `/v2/payment-requests/${orderCode}`,
    );
    const status = response.data?.status;
    const state = status === 'PAID' ? 'PAID' : status === 'CANCELLED' ? 'CANCELLED' : status === 'EXPIRED' ? 'EXPIRED' : 'PENDING';
    return { state, amountPaid: response.data?.amountPaid ?? 0 };
  }

  private requireCredentials(): PayosCredentials {
    if (!this.credentials) throw AppError.unavailable('Online payment is not configured');
    return this.credentials;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const credentials = this.requireCredentials();
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-client-id': credentials.clientId, 'x-api-key': credentials.apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return (await response.json()) as T;
    } catch (error) {
      logger.error('PayOS request failed', { path, message: (error as Error).message });
      throw AppError.unavailable('The payment provider is not reachable');
    }
  }
}

/** key=value pairs sorted by key; null / undefined become empty strings (PayOS convention). */
export function canonicalize(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const value = data[key];
      const text = value === null || value === undefined || value === 'null' || value === 'undefined' ? '' : String(value);
      return `${key}=${text}`;
    })
    .join('&');
}

export function createPayosProviderFromEnv(): PayosProvider {
  const { PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY } = env;
  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) return new PayosProvider(undefined);
  return new PayosProvider({ clientId: PAYOS_CLIENT_ID, apiKey: PAYOS_API_KEY, checksumKey: PAYOS_CHECKSUM_KEY });
}
