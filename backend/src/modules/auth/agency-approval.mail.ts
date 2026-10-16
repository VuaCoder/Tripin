import type { MailMessage } from '../../integrations/mail';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

/** Inline styles and presentation tables keep alignment and brand colors consistent in email clients. */
function approvalEmailHtml(subject: string, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f8f5;font-family:'Segoe UI',Arial,sans-serif;color:#1b2b34;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8f5;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border:1px solid #e2e8e5;border-radius:16px;overflow:hidden;">
        <tr><td align="center" bgcolor="#087e8b" style="padding:32px 24px;background-color:#087e8b;border-radius:16px 16px 0 0;">
          <p style="margin:0;color:#ffffff;font-size:27px;font-weight:700;line-height:1.3;">Tripri Partner</p>
          <p style="margin:8px 0 0;color:#eafcff;font-size:13px;line-height:1.6;">Đối tác doanh nghiệp du lịch</p>
        </td></tr>
        <tr><td align="center" style="padding:28px 24px 4px;text-align:center;">
          <h1 style="margin:0;color:#00636e;font-size:23px;line-height:1.5;font-weight:700;text-align:center;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;font-size:14px;line-height:1.8;color:#42605f;overflow-wrap:anywhere;word-break:break-word;">
          ${body}
          <p style="margin:24px 0 0;">Trân trọng,<br><strong style="color:#00636e;">Đội ngũ Tripri Partner</strong></p>
        </td></tr>
        <tr><td align="center" style="padding:18px 24px;background-color:#eef6f3;border-radius:0 0 16px 16px;color:#526f6c;font-size:12px;line-height:1.7;text-align:center;">
          &copy; ${new Date().getFullYear()} Tripri Travel Platform<br>Email tự động, vui lòng không phản hồi.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildAgencyApprovedMail(to: string, companyName: string): MailMessage {
  const subject = '[Tripri Partner] Chúc mừng! Hồ sơ Agency của bạn đã được phê duyệt';
  const text = `Xin chào ${companyName},\n\n` +
    'Hồ sơ Agency của bạn đã được phê duyệt!\n\n' +
    'Chào mừng bạn trở thành đối tác kinh doanh du lịch trên Tripri. Bạn có thể đăng nhập vào Tripri để tạo tour, thiết lập ngày khởi hành và quản lý hoạt động kinh doanh.\n\n' +
    'Trân trọng,\nĐội ngũ Tripri Partner';
  const html = approvalEmailHtml(subject, 'Hồ sơ đã được phê duyệt', `
    <p style="margin:0 0 16px;">Xin chào <strong>${escapeHtml(companyName)}</strong>,</p>
    <p style="margin:0 0 16px;">Chúc mừng! Hồ sơ doanh nghiệp của bạn đã được phê duyệt. Chào mừng bạn trở thành đối tác kinh doanh du lịch trên Tripri.</p>
    <p style="margin:0;padding:16px 18px;border-radius:8px;background-color:#eef8f4;color:#245c53;">Bạn có thể đăng nhập vào Tripri để bắt đầu tạo tour, thiết lập ngày khởi hành và quản lý hoạt động kinh doanh.</p>`);
  return { to, subject, text, html };
}

export function buildAgencyRejectedMail(to: string, companyName: string, reason: string): MailMessage {
  const subject = '[Tripri Partner] Hồ sơ Agency cần chỉnh sửa, bổ sung';
  const text = `Xin chào ${companyName},\n\n` +
    'Hồ sơ cần chỉnh sửa\n\n' +
    'Cảm ơn bạn đã đăng ký trở thành đối tác Tripri. Hồ sơ của bạn cần được bổ sung trước khi tiếp tục xét duyệt.\n\n' +
    `Nội dung cần bổ sung:\n${reason}\n\n` +
    'Vui lòng quay lại Tripri, chọn Chỉnh sửa hồ sơ, cập nhật thông tin và gửi lại để ban quản trị tiếp tục xem xét.\n\n' +
    'Trân trọng,\nĐội ngũ Tripri Partner';
  const html = approvalEmailHtml(subject, 'Hồ sơ cần chỉnh sửa', `
    <p style="margin:0 0 16px;">Xin chào <strong>${escapeHtml(companyName)}</strong>,</p>
    <p style="margin:0 0 16px;">Cảm ơn bạn đã đăng ký trở thành đối tác Tripri. Hồ sơ của bạn cần được bổ sung trước khi tiếp tục xét duyệt.</p>
    <div style="padding:16px 18px;border-radius:8px;background-color:#eef8f4;color:#245c53;">
      <p style="margin:0 0 8px;font-weight:700;">Nội dung cần bổ sung</p>
      <p style="margin:0;">${escapeHtml(reason).replace(/\r?\n/g, '<br>')}</p>
    </div>
    <p style="margin:18px 0 0;">Vui lòng quay lại Tripri, chọn <strong>Chỉnh sửa hồ sơ</strong>, cập nhật thông tin và gửi lại để ban quản trị tiếp tục xem xét.</p>`);
  return { to, subject, text, html };
}
