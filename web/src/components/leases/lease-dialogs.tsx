'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { FieldLabelWithHelp } from '@/components/field-help';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import type { EndReason } from '@/lib/lease-types';
import { ENDABLE_REASONS, endDateBounds, planRenewalRents } from '@/lib/leases';
import { formatDate } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
const ACTIVATE = `
  mutation ActivateLease($id: uuid!, $signed: date!) {
    activate_lease(args: { p_lease_id: $id, p_signed_on: $signed }) { id status }
  }
`;

const RENEW = `
  mutation RenewLease($id: uuid!, $end: date!, $rents: jsonb, $note: String) {
    renew_lease(args: { p_lease_id: $id, p_new_end_date: $end, p_rents: $rents, p_note: $note }) { id end_date }
  }
`;

const END = `
  mutation EndLease($id: uuid!, $on: date!, $reason: String) {
    end_lease(args: { p_lease_id: $id, p_ended_on: $on, p_reason: $reason }) { id status }
  }
`;

export function ActivateDialog({ leaseId, trigger, onDone }: { leaseId: string; trigger: ReactNode; onDone: () => void }) {
  const t = useT();
  const [signedOn, setSignedOn] = useState(todayTunis());
  return (
    <LeaseActionDialog
      trigger={trigger}
      title={t.leases.dialogs.activateTitle}
      description={t.leases.dialogs.activateDescription}
      submitLabel={t.leases.dialogs.activateSubmit}
      disabled={!signedOn}
      onSubmit={async () => {
        const result = await graphql<{ activate_lease: { status: string }[] }>(ACTIVATE, { id: leaseId, signed: signedOn });
        // Staff with a missing deposit or document: the lease stays a draft and a manager decides.
        if (result.activate_lease?.[0]?.status === 'draft') toast.info(t.leases.dialogs.approvalRequested);
        else toast.success(t.leases.dialogs.activated);
        onDone();
      }}
    >
      <Field>
        <FieldLabelWithHelp htmlFor="activate-signed" help={t.leases.dialogs.signedOnHelp}>
          {t.leases.dialogs.signedOn}
        </FieldLabelWithHelp>
        <Input id="activate-signed" type="date" required value={signedOn} onChange={(event) => setSignedOn(event.target.value)} className="w-48" />
      </Field>
    </LeaseActionDialog>
  );
}

type RenewLease = Pick<LeaseDetails, 'id' | 'end_date' | 'units' | 'current_rents'>;

export function RenewDialog({ lease, trigger, onDone }: { lease: RenewLease; trigger: ReactNode; onDone: () => void }) {
  const t = useT();
  const today = todayTunis();
  const [newEnd, setNewEnd] = useState(addDays(lease.end_date > today ? lease.end_date : today, 365));
  const [note, setNote] = useState('');
  const [rows, setRows] = useState(() =>
    lease.units.map(({ unit }) => {
      const current = lease.current_rents.find((rent) => rent.unit_id === unit.id);
      return {
        unitId: unit.id,
        code: unit.code,
        rent: String(Number(current?.rent_amount ?? 0)),
        charges: Number(current?.charges_amount ?? 0) === 0 ? '' : String(Number(current?.charges_amount)),
      };
    }),
  );
  const edit = (unitId: string, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row) => (row.unitId === unitId ? { ...row, ...patch } : row)));

  return (
    <LeaseActionDialog
      trigger={trigger}
      title={t.leases.dialogs.renewTitle}
      description={t.leases.dialogs.renewDescription(formatDate(lease.end_date))}
      submitLabel={t.leases.dialogs.renewSubmit}
      disabled={!newEnd}
      onSubmit={async () => {
        const plan = planRenewalRents(rows, lease.current_rents);
        if ('error' in plan) throw new Error(plan.error);
        await graphql(RENEW, { id: lease.id, end: newEnd, rents: plan.rents, note: note.trim() || null });
        toast.success(t.leases.dialogs.renewed, { description: t.common.until(formatDate(newEnd)) });
        onDone();
      }}
    >
      <Field>
        <FieldLabelWithHelp htmlFor="renew-end" help={t.leases.dialogs.newEndHelp}>
          {t.leases.dialogs.newEnd}
        </FieldLabelWithHelp>
        <Input id="renew-end" type="date" required value={newEnd} onChange={(event) => setNewEnd(event.target.value)} className="w-48" />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t.leases.dialogs.rentsFromRenewal}</p>
        {rows.map((row) => (
          <div key={row.unitId} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-sm font-medium">{row.code}</span>
            <Input aria-label={t.leases.dialogs.newRentAria(row.code)} inputMode="decimal" className="w-32" value={row.rent} onChange={(event) => edit(row.unitId, { rent: event.target.value })} />
            <Input aria-label={t.leases.dialogs.newChargesAria(row.code)} inputMode="decimal" placeholder={t.leases.dialogs.chargesPlaceholder} className="w-32" value={row.charges} onChange={(event) => edit(row.unitId, { charges: event.target.value })} />
          </div>
        ))}
        <FieldDescription>{t.leases.dialogs.keepAmounts}</FieldDescription>
      </div>
      <Field>
        <FieldLabelWithHelp htmlFor="renew-note" help={t.leases.dialogs.noteHelp}>
          {t.leases.dialogs.note}
        </FieldLabelWithHelp>
        <Input id="renew-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}

type EndLease = Pick<LeaseDetails, 'id' | 'start_date'>;

export function EndDialog({ lease, trigger, onDone }: { lease: EndLease; trigger: ReactNode; onDone: () => void }) {
  const t = useT();
  const bounds = endDateBounds(lease.start_date, todayTunis());
  const [endedOn, setEndedOn] = useState(bounds.initial);
  const [reason, setReason] = useState<EndReason>('terminated_by_renter');
  return (
    <LeaseActionDialog
      trigger={trigger}
      title={t.leases.dialogs.endTitle}
      description={t.leases.dialogs.endDescription}
      submitLabel={t.leases.dialogs.endSubmit}
      disabled={!endedOn}
      onSubmit={async () => {
        await graphql(END, { id: lease.id, on: endedOn, reason });
        toast.success(t.leases.dialogs.ended);
        onDone();
      }}
    >
      <Field>
        <FieldLabelWithHelp htmlFor="end-date" help={t.leases.dialogs.departureHelp}>
          {t.leases.dialogs.departure}
        </FieldLabelWithHelp>
        <Input id="end-date" type="date" required min={bounds.min} max={bounds.max} value={endedOn} onChange={(event) => setEndedOn(event.target.value)} className="w-48" />
        <FieldDescription>{bounds.max ? t.leases.dialogs.latestToday : t.leases.dialogs.notStarted}</FieldDescription>
      </Field>
      <Field>
        <FieldLabelWithHelp htmlFor="end-reason" help={t.leases.dialogs.reasonHelp}>
          {t.leases.dialogs.reason}
        </FieldLabelWithHelp>
        <Select value={reason} onValueChange={(value) => setReason(value as EndReason)}>
          <SelectTrigger id="end-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENDABLE_REASONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t.leases.endReasons[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </LeaseActionDialog>
  );
}
