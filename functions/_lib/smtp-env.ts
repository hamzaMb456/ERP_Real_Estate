import { createMailer, type Mailer } from './mailer';
import { missingVariable, type Env, type Resolved } from './runtime';

const SMTP_VARIABLES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as const;

/** Builds the SMTP sender from the environment; a missing variable gives status 500 naming it (never its value). */
export function resolveMailer(env: Env, injected?: Mailer): Resolved<Mailer> {
  if (injected) return { ok: true, value: injected };
  for (const name of SMTP_VARIABLES) {
    if (!env[name]) return { ok: false, result: missingVariable(name) };
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    return { ok: false, result: missingVariable('SMTP_PORT') };
  }
  return {
    ok: true,
    value: createMailer({
      host: env.SMTP_HOST as string,
      port,
      user: env.SMTP_USER as string,
      password: env.SMTP_PASSWORD as string,
      from: env.SMTP_FROM as string,
    }),
  };
}
