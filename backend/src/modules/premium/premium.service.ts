import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';
import { paymentsService, type PaymentFacts } from '../payments';
import { notificationsService, NOTIFICATION_TYPE } from '../notifications';
import { premiumRepository } from './premium.repository';

export const premiumService = {
  async subscribe(userId: string, planId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== 'TRAVELER' && user.role !== 'TOUR_GUIDE')
      throw AppError.forbidden();
    const flag = await prisma.systemSetting.findUnique({
      where: { key: `premium.enabled.${user.role}` },
    });
    if (flag?.value !== true)
      throw AppError.unavailable('Premium chưa mở bán cho vai trò này');
    const subscription = await premiumRepository.pending(
      userId,
      user.role,
      planId,
    );
    const checkout = await paymentsService.createCheckout({
      purpose: 'SUBSCRIPTION',
      userId,
      referenceId: subscription.id,
      amount: subscription.price,
      description: 'TRIPRI PREMIUM',
      expiresAt: new Date(subscription.createdAt.getTime() + 30 * 60_000),
    });
    return { subscription, checkout };
  },
  async activate(payment: PaymentFacts) {
    const activated = await premiumRepository.activate(
      payment.referenceId,
      payment.userId,
    );
    await premiumRepository.grantDue(new Date(), payment.userId);
    const status = await premiumRepository.status(payment.userId);
    if (activated && status.active)
      await notificationsService.notify(payment.userId, {
        type: NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVATED,
        title: 'Premium đã được kích hoạt',
        body: `Premium hoạt động đến ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(status.endsAt!))}.`,
        data: { subscriptionId: payment.referenceId },
      });
  },
  async requireGuide(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (
      user?.role !== 'TOUR_GUIDE' ||
      !(await premiumRepository.status(userId)).active
    )
      throw AppError.forbidden(
        'Cần Premium đang hiệu lực để sử dụng tính năng này',
      );
  },
};
