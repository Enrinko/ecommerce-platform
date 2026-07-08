import type { PaymentStatus } from '@prisma/client';

export interface PaymentIntent {
  providerRef: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  createIntent(orderId: string, amountCents: number): Promise<PaymentIntent>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
