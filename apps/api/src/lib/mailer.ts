import { config } from '../config.js';

/**
 * Transactional email with graceful degradation.
 *
 * When SMTP is not configured the message is logged (never silently dropped)
 * and callers are told `sent:false`, so the admin UI can state the truth rather
 * than pretending a message was delivered. The `nodemailer` transport is
 * imported lazily so the app runs without it installed.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  sent: boolean;
  reason?: 'not_configured' | 'transport_unavailable' | 'error';
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!config.smtp.configured) {
    // Visible in the server log for development; no secret content beyond a
    // link the recipient would have received anyway.
    console.info(`[mail:not-configured] to=${message.to} subject=${message.subject}`);
    return { sent: false, reason: 'not_configured' };
  }

  try {
    // Loaded lazily through a variable specifier so the app builds and runs
    // without nodemailer installed (it is only needed when SMTP is configured).
    const specifier = 'nodemailer';
    const nodemailer = (await import(specifier)) as {
      createTransport: (opts: Record<string, unknown>) => { sendMail: (msg: Record<string, unknown>) => Promise<unknown> };
    };
    const transport = nodemailer.createTransport({
      host: config.smtp.host as string,
      port: config.smtp.port ?? 587,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password ?? '' } : undefined,
    });
    await transport.sendMail({
      from: config.smtp.from as string,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { sent: true };
  } catch (error) {
    console.error('[mail] delivery failed:', error instanceof Error ? error.message : error);
    return { sent: false, reason: 'error' };
  }
}
