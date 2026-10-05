import dotenv from 'dotenv';
import { logger } from '../../utils/logger';
import type { MailMessage, MailProvider } from './mail.provider';

export type { MailMessage, MailProvider } from './mail.provider';

export class ConsoleMailProvider implements MailProvider {
  constructor(private readonly includeBody: boolean = true) {}

  async send(message: MailMessage): Promise<void> {
    const header = `[mail:console] to=${message.to} subject="${message.subject}"`;

    logger.info(
      this.includeBody
        ? `${header}\n${message.text}`
        : `${header} (body not logged)`
    );
  }
}

class DynamicMailProvider implements MailProvider {
  async send(message: MailMessage): Promise<void> {
    // Load .env for local development.
    // On Render, environment variables come from Render Environment Variables.
    dotenv.config({
      path: [
        `${process.cwd()}/.env`,
        `${process.cwd()}/../.env`,
      ],
      override: false,
    });

    const apiKey = process.env.BREVO_API_KEY?.trim();

    const senderEmail =
      process.env.BREVO_SENDER_EMAIL?.trim();

    const senderName =
      process.env.BREVO_SENDER_NAME?.trim() || 'TripRI';

    // ---------------------------------------------------------
    // Validate Brevo configuration
    // ---------------------------------------------------------

    if (!apiKey) {
      logger.error(
        '[mail:brevo] ❌ BREVO_API_KEY chưa được cấu hình.'
      );

      if (process.env.NODE_ENV === 'development') {
        const header =
          `[mail:console] to=${message.to} subject="${message.subject}"`;

        logger.warn(
          '[mail:fallback] ⚠️ Development mode: OTP được in ra console.'
        );

        logger.info(`${header}\n${message.text}`);

        return;
      }

      throw new Error(
        'BREVO_API_KEY chưa được cấu hình.'
      );
    }

    if (!senderEmail) {
      logger.error(
        '[mail:brevo] ❌ BREVO_SENDER_EMAIL chưa được cấu hình.'
      );

      throw new Error(
        'BREVO_SENDER_EMAIL chưa được cấu hình.'
      );
    }

    // ---------------------------------------------------------
    // Send email through Brevo REST API
    // ---------------------------------------------------------

    logger.info(
      `[mail:brevo] 📧 Đang gửi email tới [${message.to}]...`
    );

    try {
      const response = await fetch(
        'https://api.brevo.com/v3/smtp/email',
        {
          method: 'POST',

          headers: {
            accept: 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
          },

          body: JSON.stringify({
            sender: {
              name: senderName,
              email: senderEmail,
            },

            to: [
              {
                email: message.to,
              },
            ],

            subject: message.subject,

            textContent: message.text,

            htmlContent: message.html,
          }),
        }
      );

      // -------------------------------------------------------
      // Read Brevo response
      // -------------------------------------------------------

      const responseText = await response.text();

      let data: {
        messageId?: string;
        messageIds?: string[];
        code?: string;
        message?: string;
      } = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        // Brevo response is not JSON
      }

      // -------------------------------------------------------
      // Handle Brevo error
      // -------------------------------------------------------

      if (!response.ok) {
        const errorMessage =
          data.message ||
          data.code ||
          responseText ||
          `HTTP ${response.status}`;

        logger.error(
          `[mail:brevo] ❌ Brevo API error: ${errorMessage}`
        );

        throw new Error(
          `Brevo API error (${response.status}): ${errorMessage}`
        );
      }

      // -------------------------------------------------------
      // Success
      // -------------------------------------------------------

      const messageId =
        data.messageId ||
        data.messageIds?.[0] ||
        'unknown';

      logger.info(
        `[mail:brevo] ✅ Email gửi thành công tới [${message.to}]`
      );

      logger.info(
        `[mail:brevo] MessageID: ${messageId}`
      );
    } catch (error: any) {
      logger.error(
        `[mail:brevo] ❌ Không thể gửi email tới [${message.to}]`
      );

      logger.error(
        `[mail:brevo] Error: ${error?.message || error}`
      );

      // Development: allow OTP testing through console
      if (process.env.NODE_ENV === 'development') {
        const header =
          `[mail:console] to=${message.to} subject="${message.subject}"`;

        logger.warn(
          '[mail:fallback] ⚠️ Development mode: OTP được in ra console.'
        );

        logger.info(
          `${header}\n${message.text}`
        );

        return;
      }

      // Production: do NOT silently hide email failure
      throw error;
    }
  }
}

export const mailProvider: MailProvider =
  new DynamicMailProvider();