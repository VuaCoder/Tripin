import type { PaymentPurpose, PaymentStatus } from '@travel-platform/constants';
import type { PaymentDocument } from './payments.model';
import type { CheckoutDto, PaymentDto, PaymentFacts } from './payments.types';

export function toPaymentDto(payment: PaymentDocument): PaymentDto {
  return {
    id: payment.id,
    purpose: payment.purpose as PaymentPurpose,
    referenceId: String(payment.referenceId),
    amount: payment.amount,
    currency: payment.currency ?? 'VND',
    status: payment.status as PaymentStatus,
    // The link is only useful while the payment is still open.
    checkoutUrl: payment.status === 'PENDING' ? (payment.checkoutUrl ?? undefined) : undefined,
    expiresAt: payment.expiresAt.toISOString(),
    paidAt: payment.paidAt?.toISOString(),
    createdAt: (payment as unknown as { createdAt: Date }).createdAt.toISOString(),
  };
}

export function toCheckoutDto(payment: PaymentDocument): CheckoutDto {
  return {
    paymentId: payment.id,
    checkoutUrl: payment.checkoutUrl!,
    amount: payment.amount,
    expiresAt: payment.expiresAt.toISOString(),
  };
}

export function toPaymentFacts(payment: PaymentDocument): PaymentFacts {
  return {
    id: payment.id,
    purpose: payment.purpose as PaymentPurpose,
    userId: String(payment.userId),
    referenceId: String(payment.referenceId),
    amount: payment.amount,
  };
}
