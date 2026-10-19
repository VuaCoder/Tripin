/** Vietnamese system templates, also applied when reading legacy English notifications.
 * Match complete templates only: tour names, chat messages and user-written notes stay untouched.
 */
const TITLES: Record<string, string> = {
  'Payment received': 'Đã nhận thanh toán',
  'Booking created': 'Đã tạo đơn đặt tour',
  'Booking confirmed': 'Đặt chỗ thành công',
  'New confirmed booking': 'Đơn đặt tour mới đã xác nhận',
  'A booking was cancelled': 'Đơn đặt tour đã hủy',
  'Booking expired': 'Đơn đặt tour đã hết hạn',
  'How was your trip?': 'Chuyến đi của bạn thế nào?',
  'New message': 'Tin nhắn mới',
  'New earning': 'Thu nhập mới',
  'New review': 'Đánh giá mới',
  'Your review was hidden': 'Đánh giá của bạn đã bị ẩn',
  'Your review was restored': 'Đánh giá của bạn đã được khôi phục',
  'Your agency was verified': 'Đại lý đã được xác minh',
  'Your agency verification was rejected': 'Yêu cầu xác minh đại lý chưa được chấp thuận',
  'Subscription activated': 'Gói dịch vụ đã được kích hoạt',
  'You were assigned to a tour': 'Bạn được mời dẫn tour',
  'Guide accepted the assignment': 'Hướng dẫn viên đã nhận tour',
  'Guide declined the assignment': 'Hướng dẫn viên đã từ chối tour',
  'Your tour was approved': 'Tour đã được duyệt',
  'Your tour was rejected': 'Tour cần chỉnh sửa',
  'Your tour was suspended': 'Tour đã bị tạm ẩn',
  'A traveler filed a report': 'Có báo cáo mới từ du khách',
  'The agency responded to your report': 'Đại lý đã phản hồi báo cáo của bạn',
  'Your report was reviewed': 'Báo cáo của bạn đã được xem xét',
  'A report about you was decided': 'Báo cáo liên quan đến bạn đã có kết quả',
  'Your support ticket was resolved': 'Yêu cầu hỗ trợ đã được giải quyết',
  'Support replied to your ticket': 'Yêu cầu hỗ trợ có phản hồi mới',
};

type Template = [RegExp, (...parts: string[]) => string];
const TEMPLATES: Record<string, Template[]> = {
  'Payment received': [[/^We received your payment of ([\d,.]+) VND\.$/s, amount => `Chúng tôi đã nhận thanh toán ${Number(amount.replace(/,/g, '')).toLocaleString('vi-VN')} ₫ của bạn.`]],
  'Booking created': [[/^Your booking (\S+) for "(.*)" is waiting for payment \((\d+) minutes\)\.$/s, (code, tour, minutes) => `Đơn đặt tour ${code} cho "${tour}" đang chờ thanh toán. Vui lòng thanh toán trong ${minutes} phút.`]],
  'Booking confirmed': [[/^Payment received\. Your booking (\S+) for "(.*)" is confirmed\.$/s, (code, tour) => `Đã nhận thanh toán. Đơn đặt tour ${code} cho "${tour}" đã được xác nhận.`]],
  'New confirmed booking': [[/^(\d+) traveler\(s\) booked "(.*)" \(([^)]+)\)\.$/s, (count, tour, code) => `${count} du khách đã đặt "${tour}" (${code}).`]],
  'A booking was cancelled': [[/^Booking (\S+) for "(.*)" was cancelled by the traveler\.$/s, (code, tour) => `Du khách đã hủy đơn đặt tour ${code} cho "${tour}".`]],
  'Booking expired': [[/^Booking (\S+) was cancelled because it was not paid in time\.$/s, code => `Đơn đặt tour ${code} đã bị hủy do quá thời hạn thanh toán.`]],
  'How was your trip?': [[/^Your trip "(.*)" is over\. Share your experience with a review\.$/s, tour => `Chuyến đi "${tour}" đã kết thúc. Hãy chia sẻ trải nghiệm của bạn bằng một đánh giá nhé.`]],
  'New earning': [[/^You earned ([\d,.]+) VND for "(.*)"\.$/s, (amount, tour) => `Bạn nhận được ${Number(amount.replace(/,/g, '')).toLocaleString('vi-VN')} ₫ từ tour "${tour}".`]],
  'New review': [[/^A traveler rated "(.*)" (\d+(?:\.\d+)?)\/5\.$/s, (tour, rating) => `Một du khách đã đánh giá tour "${tour}" ${rating}/5 sao.`]],
  'Your review was hidden': [[/^Your review of "(.*)" was hidden: (.*)$/s, (tour, reason) => `Đánh giá của bạn về tour "${tour}" đã bị ẩn. Lý do: ${reason}`]],
  'Your review was restored': [[/^Your review of "(.*)" is visible again\.$/s, tour => `Đánh giá của bạn về tour "${tour}" đã được hiển thị trở lại.`]],
  'Your agency was verified': [[/^Your agency profile is verified\. You can now submit tours for review\.$/s, () => 'Hồ sơ đại lý đã được xác minh. Bạn có thể gửi tour để xét duyệt.']],
  'Your agency verification was rejected': [[/^Your verification request was rejected(?:: (.*)|\.) You can update your profile and request it again\.$/s, reason => `Yêu cầu xác minh chưa được chấp thuận.${reason ? ` Lý do: ${reason}` : ''} Bạn có thể cập nhật hồ sơ và gửi lại yêu cầu.`]],
  'Subscription activated': [[/^Your "(.*)" plan is active until (\d{4})-(\d{2})-(\d{2})\.$/s, (plan, year, month, day) => `Gói "${plan}" của bạn đã được kích hoạt đến ngày ${day}/${month}/${year}.`]],
  'You were assigned to a tour': [[/^An agency assigned you to "(.*)"\. Please accept or decline the assignment\.$/s, tour => `Đại lý mời bạn dẫn tour "${tour}". Vui lòng xác nhận nhận hoặc từ chối tour.`]],
  'Guide accepted the assignment': [[/^The guide accepted "(.*)"\.(?: Note: (.*))?$/s, (tour, note) => `Hướng dẫn viên đã nhận tour "${tour}".${note ? ` Ghi chú: ${note}` : ''}`]],
  'Guide declined the assignment': [[/^The guide declined "(.*)"\.(?: Note: (.*))?$/s, (tour, note) => `Hướng dẫn viên đã từ chối tour "${tour}".${note ? ` Ghi chú: ${note}` : ''}`]],
  'Your tour was approved': [[/^"(.*)" is now public\.$/s, tour => `Tour "${tour}" đã được duyệt và công khai trên hệ thống.`]],
  'Your tour was rejected': [[/^"(.*)" was rejected: (.*)$/s, (tour, reason) => `Tour "${tour}" chưa được duyệt. Lý do: ${reason}`]],
  'Your tour was suspended': [[/^"(.*)" was suspended: (.*)$/s, (tour, reason) => `Tour "${tour}" đã bị tạm ẩn. Lý do: ${reason}`]],
  'A traveler filed a report': [[/^A report \(([^)]+)\) was filed about your (tour|account)\. Please respond\.$/s, (_category, target) => `Du khách đã gửi báo cáo liên quan đến ${target === 'tour' ? 'tour' : 'tài khoản'} của bạn. Vui lòng xem chi tiết và phản hồi.`]],
  'The agency responded to your report': [[/^The agency answered your report\. A moderator will review it\.$/s, () => 'Đại lý đã phản hồi báo cáo của bạn. Kiểm duyệt viên sẽ xem xét nội dung phản hồi.']],
  'Your report was reviewed': [[/^A moderator reviewed your report and it was (upheld|not upheld): (.*)$/s, (outcome, note) => `Kiểm duyệt viên đã xem xét báo cáo của bạn. Kết quả: ${outcome === 'upheld' ? 'báo cáo được chấp thuận' : 'báo cáo không được chấp thuận'}. ${note}`]],
  'A report about you was decided': [[/^A moderator decided a report filed about you: (upheld|not upheld)\. (.*)$/s, (outcome, note) => `Báo cáo liên quan đến bạn đã được xử lý. Kết quả: ${outcome === 'upheld' ? 'báo cáo được chấp thuận' : 'báo cáo không được chấp thuận'}. ${note}`]],
  'Your support ticket was resolved': [[/^Re: (.*)$/s, subject => `Yêu cầu hỗ trợ "${subject}" đã được giải quyết.`]],
  'Support replied to your ticket': [[/^Re: (.*)$/s, subject => `Bạn có phản hồi mới cho yêu cầu hỗ trợ "${subject}".`]],
};

export function vietnameseNotification(title: string, body: string): { title: string; body: string } {
  if (title.startsWith('Vé điện tử ')) return { title, body: body.replace(/\(booking (TRP[-A-Z0-9]+)\)/g, '(đặt chỗ $1)') };
  for (const [pattern, render] of TEMPLATES[title] ?? []) {
    const match = body.match(pattern);
    if (match) return { title: TITLES[title] ?? title, body: render(...match.slice(1)) };
  }
  // Do not translate a message preview, a user note or an already Vietnamese body.
  return { title: TITLES[title] ?? title, body };
}
