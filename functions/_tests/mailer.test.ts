import { describe, expect, it, vi } from 'vitest';
import { createMailer, smtpTransportOptions } from '../_lib/mailer';

const CONFIG = { host: 'smtp.test', port: 587, user: 'u', password: 'p', from: 'ERP <no-reply@test>' };

describe('createMailer', () => {
  it('passes from, to, subject and text to the transport', async () => {
    const sendMail = vi.fn(async () => ({}));
    const mailer = createMailer({ ...CONFIG, transport: { sendMail } });
    await mailer.send({ to: 'a@b.tn', subject: 'Sujet', text: 'Corps' });
    expect(sendMail).toHaveBeenCalledWith({ from: CONFIG.from, to: 'a@b.tn', subject: 'Sujet', text: 'Corps' });
  });

  it('rejects when the transport rejects', async () => {
    const sendMail = async () => {
      throw new Error('smtp down');
    };
    const mailer = createMailer({ ...CONFIG, transport: { sendMail } });
    await expect(mailer.send({ to: 'a@b.tn', subject: 's', text: 't' })).rejects.toThrow('smtp down');
  });
});

describe('smtpTransportOptions', () => {
  it('uses implicit TLS on port 465', () => {
    expect(smtpTransportOptions({ ...CONFIG, port: 465 })).toMatchObject({ secure: true, port: 465 });
  });
  it('uses STARTTLS (not implicit TLS) on other ports', () => {
    expect(smtpTransportOptions(CONFIG)).toMatchObject({ secure: false, port: 587, host: 'smtp.test' });
  });
});
