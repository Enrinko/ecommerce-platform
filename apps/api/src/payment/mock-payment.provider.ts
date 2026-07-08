import { Injectable } from '@nestjs/common';
import type { PaymentIntent, PaymentProvider } from './payment.provider';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async createIntent(orderId: string, _amountCents: number): Promise<PaymentIntent> {
    return { providerRef: `mock_${orderId}`, status: 'PAID' };
  }
}
