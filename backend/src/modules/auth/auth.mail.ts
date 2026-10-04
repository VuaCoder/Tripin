import type { OtpPurpose } from '@travel-platform/constants';
import type { MailMessage } from '../../integrations/mail';
import { AUTH_POLICY } from './auth.policy';

const SUBJECT: Record<OtpPurpose, string> = {
  REGISTER: 'Mã xác thực đăng ký tài khoản Tripri',
  LOGIN_2FA: 'Mã xác thực đăng nhập Tripri',
  FORGOT_PASSWORD: 'Mã xác thực khôi phục mật khẩu Tripri',
};

const TITLE: Record<OtpPurpose, string> = {
  REGISTER: 'Xác nhận đăng ký tài khoản',
  LOGIN_2FA: 'Xác thực đăng nhập',
  FORGOT_PASSWORD: 'Khôi phục mật khẩu',
};

const INTRO: Record<OtpPurpose, string> = {
  REGISTER: 'Cảm ơn bạn đã đăng ký tài khoản tại Tripri. Vui lòng sử dụng mã OTP dưới đây để hoàn tất xác thực email của bạn:',
  LOGIN_2FA: 'Vui lòng sử dụng mã OTP dưới đây để hoàn tất đăng nhập vào tài khoản Tripri của bạn:',
  FORGOT_PASSWORD: 'Bạn đã yêu cầu khôi phục mật khẩu. Vui lòng sử dụng mã OTP dưới đây để tạo mật khẩu mới:',
};

/** Builds the OTP email with rich HTML formatting and fallback text. */
export function buildOtpMail(to: string, purpose: OtpPurpose, code: string): MailMessage {
  const title = TITLE[purpose] || 'Xác thực mã OTP';
  const intro = INTRO[purpose] || 'Vui lòng sử dụng mã xác thực dưới đây:';
  const ttl = AUTH_POLICY.OTP_TTL_MINUTES;

  const text =
    `[Tripri] ${title}\n\n` +
    `${intro}\n` +
    `MÃ OTP CỦA BẠN: ${code}\n\n` +
    `Mã xác thực này có hiệu lực trong ${ttl} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`;

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${SUBJECT[purpose]}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #334155; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 32px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; tracking-spacing: -0.5px; }
        .content { padding: 32px 24px; text-align: center; }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .intro { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
        .otp-box { background: #f0fdfa; border: 2px dashed #0d9488; border-radius: 12px; padding: 18px; display: inline-block; margin: 12px 0 24px; letter-spacing: 8px; font-size: 32px; font-weight: 800; color: #0d9488; font-family: monospace; }
        .warning { font-size: 13px; color: #ef4444; background: #fef2f2; padding: 10px 16px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Tripri</h1>
        </div>
        <div class="content">
          <div class="title">${title}</div>
          <div class="intro">${intro}</div>
          <div class="otp-box">${code}</div>
          <div>
            <span class="warning">⏱️ Mã có hiệu lực trong <strong>${ttl} phút</strong></span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Vì lý do bảo mật, tuyệt đối không chia sẻ mã OTP này cho ai khác.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Tripri Travel Platform. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email này.
        </div>
      </div>
    </body>
    </html>
  `;

  return { to, subject: SUBJECT[purpose], text, html };
}
