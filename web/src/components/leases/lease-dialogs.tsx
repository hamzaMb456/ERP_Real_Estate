'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import type { EndReason } from '@/lib/lease-types';
import { END_REASON_LABELS, ENDABLE_REASONS, endDateBounds, planRenewalRents } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

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
  const [signedOn, setSignedOn] = useState(todayTunis());
  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Activer le bail"
      description="Le bail passe en « Actif » et les unités sont marquées louées. Indiquez la date de signature."
      submitLabel="Activer le bail"
      disabled={!signedOn}
      onSubmit={async () => {
        await graphql(ACTIVATE, { id: leaseId, signed: signedOn });
        toast.success('Bail activé');
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="activate-signed">Date de signature</FieldLabel>
        <Input id="activate-signed" type="date" required value={signedOn} onChange={(event) => setSignedOn(event.target.value)} className="w-48" />
      </Field>
    </LeaseActionDialog>
  );
}

type RenewLease = Pick<LeaseDetails, 'id' | 'end_date' | 'units' | 'current_rents'>;

export function RenewDialog({ lease, trigger, onDone }: { lease: RenewLease; trigger: ReactNode; onDone: () => void }) {
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
      title="Renouveler le bail"
      description={`Le bail actuel se termine le ${formatDateFr(lease.end_date)}. Le même bail est prolongé ; les loyers modifiés commencent le lendemain de la fin actuelle.`}
      submitLabel="Renouveler le bail"
      disabled={!newEnd}
      onSubmit={async () => {
        const plan = planRenewalRents(rows, lease.current_rents);
        if ('error' in plan) throw new Error(plan.error);
        await graphql(RENEW, { id: lease.id, end: newEnd, rents: plan.rents, note: note.trim() || null });
        toast.success('Bail renouvelé', { description: 'Jusqu’au ' + formatDateFr(newEnd) });
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="renew-end">Nouvelle date de fin</FieldLabel>
        <Input id="renew-end" type="date" required value={newEnd} onChange={(event) => setNewEnd(event.target.value)} className="w-48" />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium">Loyers à partir du renouvellement</p>
        {rows.map((row) => (
          <div key={row.unitId} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-sm font-medium">{row.code}</span>
            <Input aria-label={'Nouveau loyer ' + row.code} inputMode="decimal" className="w-32" value={row.rent} onChange={(event) => edit(row.unitId, { rent: event.target.value })} />
            <Input aria-label={'Nouvelles charges ' + row.code} inputMode="decimal" placeholder="Charges" className="w-32" value={row.charges} onChange={(event) => edit(row.unitId, { charges: event.target.value })} />
          </div>
        ))}
        <FieldDescription>Laissez les montants tels quels pour garder les loyers actuels.</FieldDescription>
      </div>
      <Field>
        <FieldLabel htmlFor="renew-note">Note (facultatif)</FieldLabel>
        <Input id="renew-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}

type EndLease = Pick<LeaseDetails, 'id' | 'start_date'>;

export function EndDialog({ lease, trigger, onDone }: { lease: EndLease; trigger: ReactNode; onDone: () => void }) {
  const bounds = endDateBounds(lease.start_date, todayTunis());
  const [endedOn, setEndedOn] = useState(bounds.initial);
  const [reason, setReason] = useState<EndReason>('terminated_by_renter');
  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Terminer le bail"
      description="Le locataire est parti : le bail passe en « Terminé » et les unités redeviennent disponibles. L’état des lieux de sortie et le dépôt de garantie se traitent ensuite."
      submitLabel="Terminer le bail"
      disabled={!endedOn}
      onSubmit={async () => {
        await graphql(END, { id: lease.id, on: endedOn, reason });
        toast.success('Bail terminé');
        onDone();
      }}
    >
      <Field>
        <FieldLabel htmlFor="end-date">Date de départ</FieldLabel>
        <Input id="end-date" type="date" required min={bounds.min} max={bounds.max} value={endedOn} onChange={(event) => setEndedOn(event.target.value)} className="w-48" />
        <FieldDescription>{bounds.max ? 'Au plus tard aujourd’hui.' : 'Le bail n’a pas encore commencé : il sera annulé à sa date de début.'}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="end-reason">Motif</FieldLabel>
        <Select value={reason} onValueChange={(value) => setReason(value as EndReason)}>
          <SelectTrigger id="end-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENDABLE_REASONS.map((value) => (
              <SelectItem key={value} value={value}>
                {END_REASON_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </LeaseActionDialog>
  );
}
