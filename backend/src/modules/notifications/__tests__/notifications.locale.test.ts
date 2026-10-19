import { describe, expect, it } from 'vitest';
import { vietnameseNotification } from '../notifications.locale';
import { toNotificationDto } from '../notifications.mapper';

describe('Vietnamese notification templates', () => {
  it.each([
    ['Payment received', 'We received your payment of 2,000 VND.', 'Đã nhận thanh toán', 'Chúng tôi đã nhận thanh toán 2.000 ₫ của bạn.'],
    ['Booking created', 'Your booking TRP-FT75KPTD for "Tour Ninh Bình" is waiting for payment (15 minutes).', 'Đã tạo đơn đặt tour', 'Đơn đặt tour TRP-FT75KPTD cho "Tour Ninh Bình" đang chờ thanh toán. Vui lòng thanh toán trong 15 phút.'],
    ['Booking confirmed', 'Payment received. Your booking TRP-FT75KPTD for "Tour Ninh Bình" is confirmed.', 'Đặt chỗ thành công', 'Đã nhận thanh toán. Đơn đặt tour TRP-FT75KPTD cho "Tour Ninh Bình" đã được xác nhận.'],
    ['Booking expired', 'Booking TRP-123 was cancelled because it was not paid in time.', 'Đơn đặt tour đã hết hạn', 'Đơn đặt tour TRP-123 đã bị hủy do quá thời hạn thanh toán.'],
    ['New review', 'A traveler rated "Tour Ninh Bình" 5/5.', 'Đánh giá mới', 'Một du khách đã đánh giá tour "Tour Ninh Bình" 5/5 sao.'],
    ['Subscription activated', 'Your "Premium" plan is active until 2026-11-18.', 'Gói dịch vụ đã được kích hoạt', 'Gói "Premium" của bạn đã được kích hoạt đến ngày 18/11/2026.'],
    ['Guide accepted the assignment', 'The guide accepted "Tour Huế". Note: Hẹn lúc 7 giờ.', 'Hướng dẫn viên đã nhận tour', 'Hướng dẫn viên đã nhận tour "Tour Huế". Ghi chú: Hẹn lúc 7 giờ.'],
  ])('translates %s while retaining dynamic information', (title, body, expectedTitle, expectedBody) => {
    expect(vietnameseNotification(title, body)).toEqual({ title: expectedTitle, body: expectedBody });
  });

  it('leaves chat previews, Vietnamese copy and user-provided text untouched', () => {
    expect(vietnameseNotification('New message', 'Payment received')).toEqual({ title: 'Tin nhắn mới', body: 'Payment received' });
    expect(vietnameseNotification('Đặt chỗ thành công', 'Đơn TRP-123 đã được xác nhận.')).toEqual({ title: 'Đặt chỗ thành công', body: 'Đơn TRP-123 đã được xác nhận.' });
    expect(vietnameseNotification('Your review was hidden', 'Your review of "Saigon by Night" was hidden: Please add details.').body).toBe('Đánh giá của bạn về tour "Saigon by Night" đã bị ẩn. Lý do: Please add details.');
  });

  it('translates persisted legacy rows when mapping an inbox response', () => {
    const dto = toNotificationDto({ id: 'n1', userId: 'u1', type: 'PAYMENT_SUCCEEDED', title: 'Payment received', body: 'We received your payment of 2,000 VND.', data: { paymentId: 'p1' }, readAt: null, createdAt: new Date('2026-10-18T07:54:00Z') } as never);
    expect(dto).toMatchObject({ title: 'Đã nhận thanh toán', body: 'Chúng tôi đã nhận thanh toán 2.000 ₫ của bạn.', data: { paymentId: 'p1' }, isRead: false });
    expect(dto.id).toBe('n1');
  });
});
