import nodemailer from 'nodemailer';

export type MailMessage = { to: string; subject: string; text: string };
export type Mailer = { send(message: MailMessage): Promise<void> };

type MailerConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  transport?: { sendMail(message: object): Promise<unknown> };
};

/** Port 465 is implicit TLS; every other port starts in clear text and upgrades with STARTTLS. */
export function smtpTransportOptions(config: Pick<MailerConfig, 'host' | 'port' | 'user' | 'password'>) {
  return {
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
  };
}

export function createMailer(config: MailerConfig): Mailer {
  const transport = config.transport ?? nodemailer.createTransport(smtpTransportOptions(config));
  return {
    async send(message) {
      await transport.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}
