import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffInvitationMail } from '../../../../functions/_lib/mail-templates.ts';
import type { ChangeRecord, Mailer } from './mail-events.ts';
import { handleChange } from './mail-events.ts';
import { checkToken, newInvitation } from './staff-invitations.ts';

const SECRET = 'mail-test-secret';
const APP = 'https://erp.example.tn';
const NOW = new Date('2026-10-30T10:00:00.000Z');

const invitation = (over: Record<string, unknown> = {}) => {
  const { id, expires_at } = newInvitation(NOW);
  return { id, expires_at, email: 'amel@agence.tn', display_name: 'Amel', used_at: null, revoked_at: null, ...over };
};
const fakeMailer = () => {
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = { send: async (message) => { sent.push(message); } };
  return { sent, deps: (extra: { inviteSecret?: string; appUrl?: string } = { inviteSecret: SECRET, appUrl: APP }) => ({ mailer: () => mailer, ...extra }) };
};
const change = (op: ChangeRecord['op'], row: Record<string, unknown>): ChangeRecord => ({ model: 'StaffInvitation', op, new: row, old: undefined });

test('an inserted invitation sends one mail to its address', async () => {
  const { sent, deps } = fakeMailer();
  const result = await handleChange(change('INSERT', invitation()), deps());
  assert.equal(result, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'amel@agence.tn');
});

test('the link is the app address plus /erp/invitation?token= and its token checks out', async () => {
  const { sent, deps } = fakeMailer();
  const row = invitation();
  await handleChange(change('INSERT', row), deps());
  const match = new RegExp(`${APP}/erp/invitation\\?token=([^\\s]+)`).exec(sent[0].text);
  assert.ok(match, 'the mail carries the link');
  assert.deepEqual(checkToken(SECRET, match[1], row, NOW), { ok: true, id: row.id });
});

test('nothing is sent on MODIFY or REMOVE', async () => {
  const { sent, deps } = fakeMailer();
  assert.equal(await handleChange(change('MODIFY', invitation()), deps()), 'none');
  assert.equal(await handleChange(change('REMOVE', invitation()), deps()), 'none');
  assert.equal(sent.length, 0);
});

test('a revoked or used invitation sends nothing', async () => {
  const { sent, deps } = fakeMailer();
  assert.equal(await handleChange(change('INSERT', invitation({ revoked_at: '2026-10-30T10:01:00.000Z' })), deps()), 'none');
  assert.equal(await handleChange(change('INSERT', invitation({ used_at: '2026-10-30T10:01:00.000Z' })), deps()), 'none');
  assert.equal(sent.length, 0);
});

test('the mail names the person, states the 24 hours and never offers a password', () => {
  const mail = staffInvitationMail('Amel', 'https://erp.example.tn/erp/invitation?token=abc');
  assert.match(mail.text, /Amel/);
  assert.match(mail.text, /https:\/\/erp\.example\.tn\/erp\/invitation\?token=abc/);
  assert.match(mail.text, /24 heures/);
  assert.doesNotMatch(mail.text, /mot de passe temporaire/i);
  assert.ok(mail.subject.length > 0);
});

test('without INVITE_SECRET or APP_URL nothing is sent and the handler reports what is missing', async () => {
  const { sent, deps } = fakeMailer();
  await assert.rejects(handleChange(change('INSERT', invitation()), deps({ appUrl: APP })), /INVITE_SECRET/);
  await assert.rejects(handleChange(change('INSERT', invitation()), deps({ inviteSecret: SECRET })), /APP_URL/);
  assert.equal(sent.length, 0);
});
