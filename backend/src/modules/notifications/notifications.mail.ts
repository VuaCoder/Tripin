import type { MailMessage } from '../../integrations/mail';
import { NOTIFICATION_TYPE, type NotifyInput } from './notifications.types';

export function buildNotificationMail(
  contact: { email: string; fullName: string },
  input: NotifyInput,
): MailMessage {
  const isTicket =
    input.type === NOTIFICATION_TYPE.ETICKET_ISSUED ||
    Boolean(input.data?.ticketCode);

  if (isTicket) {
    return buildETicketMail(contact, input);
  }

  if (input.type === NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING_SOON) {
    return buildSubscriptionExpiringMail(contact, input);
  }

  // Generic notification email with HTML styling
  const subject = input.title;
  const text = `Xin chào ${contact.fullName},\n\n${input.body}\n\n— Tripri Travel Platform`;
  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(input.title)}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #005a64 0%, #087e8b 100%); padding: 28px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
        .content { padding: 32px 24px; }
        .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }
        .body-text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Tripri</h1>
        </div>
        <div class="content">
          <div class="title">${escapeHtml(input.title)}</div>
          <div class="body-text">${escapeHtml(input.body)}</div>
          <p style="font-size: 13px; color: #64748b; margin: 0;">Xin chân thành cảm ơn bạn đã đồng hành cùng Tripri.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Tripri Travel Platform.
        </div>
      </div>
    </body>
    </html>
  `;

  return { to: contact.email, subject, text, html };
}

function buildETicketMail(
  contact: { email: string; fullName: string },
  input: NotifyInput,
): MailMessage {
  const data = (input.data || {}) as Record<string, any>;
  const ticketCode = String(data.ticketCode || 'ETK-TRIPRI');
  const bookingCode = String(data.bookingCode || 'TRP-CONFIRMED');
  const tourTitle = String(data.tourTitle || 'Tour du lịch bản địa');
  const contactName = String(data.contactName || contact.fullName);
  const participants = Number(data.participants || 1);
  const departureDateRaw = data.departureDate ? new Date(data.departureDate) : null;
  const formattedDepartureDate = departureDateRaw && !isNaN(departureDateRaw.getTime())
    ? departureDateRaw.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Theo lịch trình đã đăng ký';

  const subject = `[Vé điện tử Tripri] ${ticketCode} — ${tourTitle}`;

  const text =
    `[Tripri] VÉ ĐIỆN TỬ TOUR DU LỊCH ĐÃ SẴN SÀNG\n\n` +
    `Xin chào ${contactName},\n` +
    `Bạn đã hoàn tất đăng ký tour thành công. Dưới đây là thông tin vé điện tử của bạn:\n\n` +
    `-----------------------------------------\n` +
    `MÃ VÉ ĐIỆN TỬ: ${ticketCode}\n` +
    `MÃ ĐẶT CHỖ: ${bookingCode}\n` +
    `TOUR: ${tourTitle}\n` +
    `HÀNH KHÁCH: ${contactName}\n` +
    `SỐ LƯỢNG: ${participants} người\n` +
    `NGÀY KHỞI HÀNH: ${formattedDepartureDate}\n` +
    `TRẠNG THÁI: HỢP LỆ (CONFIRMED)\n` +
    `-----------------------------------------\n\n` +
    `📱 HƯỚNG DẪN SỬ DỤNG VÉ TRÊN ĐIỆN THOẠI:\n` +
    `Bạn chỉ cần mở email này trên điện thoại thông minh để xuất trình mã vé hoặc mã QR cho hướng dẫn viên khi bắt đầu chuyến đi. Bạn hoàn toàn không cần mang theo laptop hay in vé giấy!\n\n` +
    `Chúc bạn có một chuyến đi tuyệt vời cùng Tripri!`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticketCode)}`;

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vé điện tử Tripri - ${escapeHtml(ticketCode)}</title>
      <style>
        body { margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 35px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .hero { background: linear-gradient(135deg, #005a64 0%, #087e8b 100%); padding: 30px 24px; text-align: center; color: #ffffff; }
        .hero h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        .hero p { margin: 6px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; font-weight: 600; }
        .body { padding: 26px 20px; }
        .ticket-card { background: #fafafa; border: 2px dashed #087e8b; border-radius: 16px; padding: 22px; position: relative; }
        .ticket-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
        .ticket-code-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .ticket-code-val { font-size: 22px; font-weight: 800; color: #087e8b; font-family: monospace; letter-spacing: 1px; margin-top: 2px; }
        .status-badge { background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 999px; text-transform: uppercase; border: 1px solid #bbf7d0; display: inline-block; }
        .tour-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 4px 0 16px; line-height: 1.4; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .info-table td { padding: 7px 0; font-size: 14px; }
        .info-label { color: #64748b; width: 40%; font-size: 13px; }
        .info-val { font-weight: 600; color: #1e293b; text-align: right; }
        .qr-section { text-align: center; padding-top: 18px; border-top: 1px dashed #cbd5e1; margin-top: 8px; }
        .qr-img { border-radius: 10px; border: 1px solid #e2e8f0; display: inline-block; background: #ffffff; padding: 8px; }
        .mobile-tip { margin-top: 22px; background: #f0fdf4; border-radius: 14px; padding: 16px 18px; border: 1px solid #86efac; text-align: left; }
        .mobile-tip-title { font-size: 14px; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 6px; }
        .mobile-tip-desc { margin: 6px 0 0; font-size: 13px; color: #15803d; line-height: 1.5; }
        .footer { background: #f8fafc; padding: 22px 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="hero">
          <h1>Tripri</h1>
          <p>Xác Nhận Đăng Ký & Vé Điện Tử / E-Ticket</p>
        </div>

        <div class="body">
          <div class="ticket-card">
            <table style="width: 100%; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
              <tr>
                <td style="text-align: left;">
                  <div class="ticket-code-label">Mã vé điện tử</div>
                  <div class="ticket-code-val">${escapeHtml(ticketCode)}</div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                  <span class="status-badge">✓ HỢP LỆ</span>
                </td>
              </tr>
            </table>

            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Chuyến đi đã đăng ký</div>
            <div class="tour-title">${escapeHtml(tourTitle)}</div>

            <table class="info-table">
              <tr>
                <td class="info-label">Hành khách:</td>
                <td class="info-val">${escapeHtml(contactName)}</td>
              </tr>
              <tr>
                <td class="info-label">Số lượng khách:</td>
                <td class="info-val">${participants} người</td>
              </tr>
              <tr>
                <td class="info-label">Ngày khởi hành:</td>
                <td class="info-val" style="color: #087e8b;">${escapeHtml(formattedDepartureDate)}</td>
              </tr>
              <tr>
                <td class="info-label">Mã đặt chỗ:</td>
                <td class="info-val" style="font-family: monospace;">${escapeHtml(bookingCode)}</td>
              </tr>
            </table>

            <div class="qr-section">
              <img src="${qrUrl}" alt="Mã QR vé ${escapeHtml(ticketCode)}" width="150" height="150" class="qr-img" />
              <p style="margin: 8px 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                Quét mã QR để đối chiếu vé khi bắt đầu chuyến đi
              </p>
            </div>
          </div>

          <div class="mobile-tip">
            <div class="mobile-tip-title">
              📱 Sử dụng vé tiện lợi trên điện thoại di động
            </div>
            <p class="mobile-tip-desc">
              Bạn chỉ cần mở email này trên điện thoại hoặc máy tính bảng khi đến điểm tập trung để hướng dẫn viên quét mã. <strong>Không cần in vé giấy hay mang theo máy tính xách tay!</strong>
            </p>
          </div>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} Tripri Travel Platform. Hỗ trợ 24/7 qua hotline & ứng dụng.<br/>
          Chúc bạn có một hành trình du lịch trọn vẹn và an toàn!
        </div>
      </div>
    </body>
    </html>
  `;

  return { to: contact.email, subject, text, html };
}

function buildSubscriptionExpiringMail(
  contact: { email: string; fullName: string },
  input: NotifyInput,
): MailMessage {
  const data = (input.data || {}) as Record<string, any>;
  const planName = String(data.planName || 'Tripri Premium');
  const endsAtRaw = data.endsAt ? new Date(data.endsAt) : null;
  const formattedEndsAt = endsAtRaw && !isNaN(endsAtRaw.getTime())
    ? endsAtRaw.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'trong 3 ngày tới';

  const appUrl = process.env.APP_URL || 'https://tripri.vn';
  const renewUrl = `${appUrl.replace(/\/+$/, '')}/premium`;

  const subject = `[Tripri Premium] Gói hội viên của bạn sắp hết hạn sau 3 ngày`;

  const text =
    `[Tripri Premium] THÔNG BÁO HẾT HẠN GÓI HỘI VIÊN\n\n` +
    `Xin chào ${contact.fullName},\n\n` +
    `Gói hội viên Tripri Premium (${planName}) của bạn sẽ hết hạn vào ngày ${formattedEndsAt}.\n\n` +
    `Khi gói hết hạn, các đặc quyền VIP sau sẽ tạm ngưng:\n` +
    `- Huy hiệu & viền vương miện vàng hoàng gia nhận diện uy tín\n` +
    `- Các voucher giảm giá độc quyền dành riêng cho thành viên Premium\n` +
    `- Kênh tổng đài hỗ trợ ưu tiên 24/7\n\n` +
    `Để duy trì liên tục quyền lợi và không bỏ lỡ những voucher hấp dẫn cho chuyến đi sắp tới, bạn vui lòng truy cập đường dẫn sau để gia hạn:\n` +
    `${renewUrl}\n\n` +
    `Cảm ơn bạn đã tin tưởng và đồng hành cùng Tripri!`;

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subject)}</title>
      <style>
        body { margin: 0; padding: 20px 10px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
        .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%); padding: 36px 24px; text-align: center; color: #ffffff; position: relative; }
        .crown-badge { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 999px; margin-bottom: 12px; border: 1px solid #fcd34d; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
        .content { padding: 32px 26px; }
        .alert-card { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .alert-days { font-size: 13px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; }
        .alert-title { font-size: 19px; font-weight: 800; color: #78350f; margin: 4px 0 6px; }
        .alert-date { font-size: 14px; color: #92400e; font-weight: 600; }
        .benefits-list { background: #fafafa; border-radius: 14px; padding: 18px 20px; border: 1px solid #f1f5f9; margin-bottom: 28px; }
        .benefits-title { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .benefit-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #334155; line-height: 1.5; }
        .benefit-item:last-child { margin-bottom: 0; }
        .benefit-icon { color: #d97706; font-size: 15px; line-height: 1; flex-shrink: 0; margin-top: 2px; }
        .cta-wrapper { text-align: center; margin: 32px 0 16px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #005a64 0%, #087e8b 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(8, 126, 139, 0.35); }
        .footer { background: #f8fafc; padding: 22px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="crown-badge">👑 TRIPRI PREMIUM</div>
          <h1>Gói Hội Viên Sắp Hết Hạn</h1>
        </div>
        <div class="content">
          <p style="font-size: 15px; margin-top: 0; line-height: 1.6; color: #1e293b;">
            Xin chào <strong>${escapeHtml(contact.fullName)}</strong>,
          </p>
          <div class="alert-card">
            <div class="alert-days">Cảnh báo sắp hết hạn</div>
            <div class="alert-title">Còn 3 ngày trải nghiệm Premium</div>
            <div class="alert-date">Gói ${escapeHtml(planName)} · Hết hạn vào ${escapeHtml(formattedEndsAt)}</div>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Sau ngày <strong>${escapeHtml(formattedEndsAt)}</strong>, quyền lợi thành viên VIP của bạn sẽ tạm ngưng hoạt động. Đừng để gián đoạn trải nghiệm du lịch tuyệt vời cùng Tripri!
          </p>
          <div class="benefits-list">
            <div class="benefits-title">Đặc quyền Premium sẽ tạm ngưng:</div>
            <div class="benefit-item">
              <span class="benefit-icon">👑</span>
              <span><strong>Viền vương miện hoàng gia:</strong> Biểu tượng nhận diện đẳng cấp và uy tín VIP trên hồ sơ cá nhân.</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">🎫</span>
              <span><strong>Kho voucher giảm giá:</strong> Các voucher ưu đãi định kỳ dành riêng cho tour tuyển chọn.</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">🎧</span>
              <span><strong>Hỗ trợ ưu tiên 24/7:</strong> Kênh giải quyết yêu cầu đặc biệt trực tiếp từ nhân viên sàn.</span>
            </div>
          </div>
          <div class="cta-wrapper">
            <a href="${escapeHtml(renewUrl)}" class="cta-button">Gia hạn gói Premium ngay</a>
          </div>
          <p style="font-size: 12px; text-align: center; color: #94a3b8; margin: 12px 0 0;">
            Thanh toán một lần qua PayOS / VietQR · An toàn &amp; Nhanh chóng
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Tripri Travel Platform · Hotline 1900 6868 (24/7)<br/>
          Nếu bạn đã gia hạn gói Premium, vui lòng bỏ qua email thông báo này.
        </div>
      </div>
    </body>
    </html>
  `;

  return { to: contact.email, subject, text, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
