// Regional staff accounts: the manager's operations, and the two public steps behind an invitation link.
import { checkInvitation, confirmActivation, createStaffRecord, listStaffActivity, lookupStaff, offboardStaff, resendInvitation, resetStaffMfa } from '../../domain/staff-accounts.ts';
import type { Op } from '../registry.ts';
import { ANYONE, WRITERS, mutation, query } from '../registry.ts';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The secret holding INVITE_SECRET, read once per warm container. Imported on use so tests need no AWS client. */
async function inviteEnv(): Promise<{ INVITE_SECRET?: string }> {
  const { resolveSecretEnv } = await import('../../../../../functions/_lib/secrets');
  return resolveSecretEnv(process.env);
}

export const staffOps: Record<string, Op> = {
  CreateStaffRecord: mutation(WRITERS, async (c, v) => ({
    create_staff: await createStaffRecord(c, {
      user_id: str(v.user_id), email: str(v.email), display_name: str(v.display_name), branch_ids: (v.branch_ids as string[] | null) ?? [],
    }),
  })),
  ResendStaffInvitation: mutation(WRITERS, async (c, v) => ({ resend_staff_invitation: await resendInvitation(c, str(v.user_id)) })),
  ResetStaffMfa: mutation(WRITERS, async (c, v) => ({ reset_staff_mfa: await resetStaffMfa(c, str(v.user_id)) })),
  OffboardStaff: mutation(WRITERS, async (c, v) => {
    await offboardStaff(c, str(v.user_id));
    return { offboard_staff: { user_id: str(v.user_id) } };
  }),
  StaffMemberLookup: query(WRITERS, async (c, v) => ({ staff_member: await lookupStaff(c, str(v.user_id)) })),
  StaffActivityList: query(WRITERS, async (c) => ({ staff_activity: await listStaffActivity(c) })),

  /** The activation page: is this link valid? One answer for every kind of failure. */
  StaffInvitationCheck: query(ANYONE, async (_c, v) => ({ staff_invitation: await checkInvitation(await inviteEnv(), str(v.token)) })),
  /** Called by the web server once the authenticator code was verified; it must carry the proof only the servers can compute. */
  ConfirmStaffActivation: mutation(ANYONE, async (_c, v) => ({ confirm_staff_activation: await confirmActivation(await inviteEnv(), str(v.token), str(v.proof)) })),
};
