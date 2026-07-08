import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentModule } from '../payment/payment.module';

@Module({ imports: [PaymentModule], controllers: [OrdersController], providers: [OrdersService] })
export class OrdersModule {}
