// Public surface of subscriptions.
import { PAYMENT_PURPOSE } from '@travel-platform/constants';
import { paymentEvents } from '../payments';
import { subscriptionsService } from './subscriptions.service';

export { subscriptionsRouter } from './subscriptions.routes';
export { subscriptionsService, SubscriptionsService } from './subscriptions.service';
export { subscriptionsRepository } from './subscriptions.repository';
export { SUBSCRIPTION_STATUS, type SubscriptionDto } from './subscriptions.types';

/**
 * A verified SUBSCRIPTION payment activates the subscription (one handler per purpose). Registered once at start-up
 * when `routes/index.ts` imports this module.
 */
paymentEvents.onPaid(PAYMENT_PURPOSE.SUBSCRIPTION, (payment) => subscriptionsService.activateFromPayment(payment));
