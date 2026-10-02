/**
 * Abstraction over the payment gateway. Business code (payments.service) depends ONLY on this interface, so PayOS can be
 * replaced or complemented without touching booking / subscription logic (AI rules §15).
 */
export interface CreatePaymentLinkInput {
  /** Our unique numeric reference of the payment at the gateway. */
  orderCode: number;
  /** Integer VND. */
  amount: number;
  /** Short text shown on the bank transfer. */
  description: string;
  returnUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export interface PaymentLink {
  providerPaymentLinkId: string;
  checkoutUrl: string;
}

/** A webhook whose signature has been verified. Everything else in the payload must be treated as untrusted. */
export interface VerifiedWebhook {
  orderCode: number;
  amount: number;
  paymentLinkId?: string;
  /** True only for a successful payment event. */
  success: boolean;
  /** Bank reference of the transfer, when provided. */
  reference?: string;
}

export type ProviderPaymentState = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface ProviderPaymentStatus {
  state: ProviderPaymentState;
  amountPaid: number;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink>;
  /** Throws `AppError` (400) when the signature is missing/invalid. */
  verifyWebhook(payload: unknown): VerifiedWebhook;
  /** Asks the gateway for the real state of an order (used to reconcile when a webhook was missed). */
  getPaymentStatus(orderCode: number): Promise<ProviderPaymentStatus>;
}
