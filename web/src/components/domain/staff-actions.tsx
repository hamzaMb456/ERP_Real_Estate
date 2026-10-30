'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toUserMessage } from '@/lib/errors';
import { staffAction } from '@/lib/staff-api';

import { useT } from '@/i18n/provider';

export type StaffStatus = 'invited' | 'confirmed' | 'disabled';

/** What a manager can do to a staff account, by status: resend, reset the authenticator, disable (with a confirmation). */
export function StaffActions({
  member,
  onDone,
}: {
  member: { user_id: string; display_name: string; status: StaffStatus };
  onDone: () => void;
}) {
  const t = useT();
  const f = t.properties.branchForm;
  const [busy, setBusy] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  async function run(action: 'resend' | 'resetmfa' | 'disable', done: string) {
    setBusy(true);
    try {
      await staffAction(action, { userId: member.user_id });
      toast.success(done, { description: member.display_name });
      setConfirmingDisable(false);
      onDone();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (member.status === 'disabled') return null;

  return (
    <>
      {member.status === 'invited' && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run('resend', f.resent)}>
          {f.resend}
        </Button>
      )}
      {member.status === 'confirmed' && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run('resetmfa', f.resetDone)}>
          {f.resetMfa}
        </Button>
      )}
      <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => setConfirmingDisable(true)}>
        {f.disable}
      </Button>

      <Dialog open={confirmingDisable} onOpenChange={setConfirmingDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{f.disableTitle}</DialogTitle>
            <DialogDescription>{f.disableBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDisable(false)}>
              {t.properties.flow.cancel}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void run('disable', f.disabledDone)}>
              {f.disableConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
