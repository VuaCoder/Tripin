import type { PaymentPurpose, PaymentStatus } from '@travel-platform/constants';
import type { PaymentRecord } from './payments.repository';
import type { CheckoutDto, PaymentDto, PaymentFacts } from './payments.types';

export function toPaymentDto(payment: PaymentRecord): PaymentDto {
  return {
    id: payment.id,
    purpose: payment.purpose as PaymentPurpose,
    referenceId: payment.referenceId,
    amount: payment.amount,
    currency: payment.currency ?? 'VND',
    status: payment.status as PaymentStatus,
    // The link is only useful while the payment is still open.
    checkoutUrl: payment.status === 'PENDING' ? (payment.checkoutUrl ?? undefined) : undefined,
    expiresAt: payment.expiresAt.toISOString(),
    paidAt: payment.paidAt?.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toCheckoutDto(payment: PaymentRecord): CheckoutDto {
  return {
    paymentId: payment.id,
    checkoutUrl: payment.checkoutUrl!,
    amount: payment.amount,
    expiresAt: payment.expiresAt.toISOString(),
  };
}

export function toPaymentFacts(payment: PaymentRecord): PaymentFacts {
  return {
    id: payment.id,
    purpose: payment.purpose as PaymentPurpose,
    userId: payment.userId,
    referenceId: payment.referenceId,
    amount: payment.amount,
  };
}
