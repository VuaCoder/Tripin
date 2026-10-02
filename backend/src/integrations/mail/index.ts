import nodemailer from 'nodemailer';
import { env, isProduction } from '../../config/env';
import { logger } from '../../utils/logger';
import type { MailMessage, MailProvider } from './mail.provider';

export type { MailMessage, MailProvider } from './mail.provider';

class SmtpMailProvider implements MailProvider {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

/**
 * Fallback when SMTP is not configured. In development it writes the whole email (including OTP codes) to the log so
 * flows can be tried without a mail server; in production it logs recipient and subject ONLY, so one-time codes and
 * reset links never end up in log storage.
 */
export class ConsoleMailProvider implements MailProvider {
  constructor(private readonly includeBody: boolean = !isProduction) {}

  async send(message: MailMessage): Promise<void> {
    const header = `[mail:console] to=${message.to} subject="${message.subject}"`;
    logger.info(this.includeBody ? `${header}
${message.text}` : `${header} (body not logged)`);
  }
}

function createMailProvider(): MailProvider {
  if (env.SMTP_HOST) return new SmtpMailProvider();
  if (isProduction) logger.warn('SMTP_HOST is not configured: emails (OTP, notifications) will NOT be delivered');
  return new ConsoleMailProvider();
}

export const mailProvider: MailProvider = createMailProvider();
