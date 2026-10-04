import path from 'node:path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { MailMessage, MailProvider } from './mail.provider';

export type { MailMessage, MailProvider } from './mail.provider';

export class ConsoleMailProvider implements MailProvider {
  constructor(private readonly includeBody: boolean = true) {}

  async send(message: MailMessage): Promise<void> {
    const header = `[mail:console] to=${message.to} subject="${message.subject}"`;
    logger.info(this.includeBody ? `${header}\n${message.text}` : `${header} (body not logged)`);
  }
}

class DynamicMailProvider implements MailProvider {
  async send(message: MailMessage): Promise<void> {
    // Dynamically re-read .env file from disk to ensure any changes are picked up immediately without server restart
    dotenv.config({ path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')], override: true });

    const host = process.env.SMTP_HOST || env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || env.SMTP_USER;
    const rawPass = process.env.SMTP_PASSWORD || env.SMTP_PASSWORD || '';
    const pass = rawPass.replace(/\s+/g, ''); // strip spaces from App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
    let from = process.env.MAIL_FROM || env.MAIL_FROM || 'Tripri <no-reply@tripri.local>';

    // If Gmail account is used, ensure FROM header has the authenticated user address to avoid Gmail rejection
    if (user && user.includes('@gmail.com') && from.includes('@tripri.local')) {
      from = `Tripri <${user}>`;
    }

    if (host && host.trim() !== '') {
      const isGmail = host.toLowerCase().includes('gmail') || Boolean(user && user.toLowerCase().endsWith('@gmail.com'));
      logger.info(`[mail:smtp] 📧 Đang gửi email thật tới [${message.to}] qua ${isGmail ? 'Gmail Service' : `server ${host}:${port}`}...`);

      const transporter = nodemailer.createTransport(
        isGmail
          ? {
              service: 'gmail',
              auth: { user, pass },
            }
          : {
              host,
              port,
              secure: port === 465,
              auth: user ? { user, pass } : undefined,
            }
      );

      try {
        const info = await transporter.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        logger.info(`[mail:smtp] ✅ ĐÃ GỬI EMAIL THẬT THÀNH CÔNG tới [${message.to}]! MessageID: ${info.messageId}`);
      } catch (err: any) {
        logger.error(`[mail:smtp] ❌ Lỗi Gmail SMTP (${err.message}). Vui lòng kiểm tra lại 16 ký tự Google App Password trong .env.`);
        if (env.NODE_ENV === 'development') {
          logger.warn(`[mail:fallback] ⚠️ Do lỗi kết nối Gmail SMTP ở môi trường dev, OTP đã được in tạm ra console dưới đây:`);
          const header = `[mail:console] to=${message.to} subject="${message.subject}"`;
          logger.info(`${header}\n${message.text}`);
        } else {
          throw new Error(`Không thể gửi email qua Gmail: ${err.message}`);
        }
      }
    } else {
      const header = `[mail:console] to=${message.to} subject="${message.subject}"`;
      logger.warn(`⚠️ SMTP_HOST chưa được điền trong file .env! Đã in OTP ra console server.`);
      logger.info(`${header}\n${message.text}`);
    }
  }
}

export const mailProvider: MailProvider = new DynamicMailProvider();
