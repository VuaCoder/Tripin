export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export type PaymentPurpose = 'BOOKING' | 'SUBSCRIPTION';

export interface CheckoutDto {
  paymentId: string;
  checkoutUrl: string;
  amount: number;
  expiresAt: string;
}

export interface PaymentDto {
  id: string;
  purpose: PaymentPurpose;
  referenceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl?: string | null;
  paidAt?: string | null;
  expiresAt: string;
}

export interface PaymentApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
