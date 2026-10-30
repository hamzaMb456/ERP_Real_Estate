// DynamoDB Streams (Notification, AppointmentParticipant, Appointment, StaffInvitation) -> e-mails.
// SMTP + APP_URL come from the Secrets Manager secret the functions/ Lambdas already use.
import { resolveSecretEnv } from '../../../../functions/_lib/secrets';
import { resolveMailer } from '../../../../functions/_lib/smtp-env';
import type { Mailer } from '../domain/mail-events.ts';
import { fromStreamRecord, handleChange } from '../domain/mail-events.ts';

type StreamEvent = { Records?: Parameters<typeof fromStreamRecord>[0][] };

export const handler = async (event: StreamEvent) => {
  const env = await resolveSecretEnv(process.env);
  let mailer: Mailer | undefined;
  const getMailer = (): Mailer => {
    if (!mailer) {
      const resolved = resolveMailer(env);
      if (!resolved.ok) throw new Error(`mailer not configured: ${JSON.stringify(resolved.result.body)}`);
      mailer = resolved.value;
    }
    return mailer;
  };

  // Each record on its own: one bad record must not replay (and re-mail) the whole batch.
  const results: string[] = [];
  for (const record of event.Records ?? []) {
    try {
      results.push(await handleChange(fromStreamRecord(record), { mailer: getMailer, appUrl: env.APP_URL, inviteSecret: env.INVITE_SECRET }));
    } catch (err) {
      // Missing SMTP config fails before any mail goes out: throw so the stream retries the batch.
      if ((err as Error).message.startsWith('mailer not configured')) throw err;
      console.error('mailer: record failed:', (err as Error).message);
      results.push('error');
    }
  }
  return { processed: results.length, results };
};
