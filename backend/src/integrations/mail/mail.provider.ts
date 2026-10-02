export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Abstraction over the email transport. Business code depends on this interface only. */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
