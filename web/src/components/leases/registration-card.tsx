'use client';

import { useState } from 'react';
import { FileBadge } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { FieldLabelWithHelp } from '@/components/field-help';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import { describeRegistration } from '@/lib/leases';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
const SAVE = `
  mutation SaveRegistration($id: uuid!, $on: date, $receipt: String) {
    update_leases_by_pk(pk_columns: { id: $id }, _set: { registered_at: $on, registration_receipt: $receipt }) { id }
  }
`;

const TONE = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  warning: 'rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-foreground',
  danger: 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive',
};

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

function RegistrationDialog({ lease, onDone }: { lease: LeaseDetails; onDone: () => void }) {
  const t = useT();
  const [registeredOn, setRegisteredOn] = useState(lease.registered_at ?? todayTunis());
  const [receipt, setReceipt] = useState(lease.registration_receipt ?? '');
  return (
    <LeaseActionDialog
      trigger={<Button variant="outline">{lease.registered_at ? t.common.edit : t.leases.registration.register}</Button>}
      title={t.leases.registration.dialogTitle}
      description={t.leases.registration.dialogDescription}
      submitLabel={t.common.save}
      disabled={!registeredOn}
      onSubmit={async () => {
        await graphql(SAVE, { id: lease.id, on: registeredOn, receipt: receipt.trim() || null });
        toast.success(t.leases.registration.done);
        onDone();
      }}
    >
      <Field>
        <FieldLabelWithHelp htmlFor="registered-on" help={t.leases.registration.registeredOnHelp}>
          {t.leases.registration.registeredOnLabel}
        </FieldLabelWithHelp>
        <Input id="registered-on" type="date" required min={lease.signed_at ?? undefined} value={registeredOn} onChange={(event) => setRegisteredOn(event.target.value)} className="w-48" />
      </Field>
      <Field>
        <FieldLabelWithHelp htmlFor="registered-receipt" help={t.leases.registration.receiptHelp}>
          {t.leases.registration.receipt}
        </FieldLabelWithHelp>
        <Input id="registered-receipt" value={receipt} onChange={(event) => setReceipt(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}

export function RegistrationCard({ lease, canEdit, onChanged }: Props) {
  const t = useT();
  const info = describeRegistration(
    {
      status: lease.status,
      registration_state: lease.overview?.registration_state ?? 'not_applicable',
      registration_deadline: lease.overview?.registration_deadline ?? null,
      registered_at: lease.registered_at,
      registration_receipt: lease.registration_receipt,
    },
    todayTunis(),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileBadge className="size-4 text-muted-foreground" aria-hidden />
          {t.leases.registration.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm', TONE[info.tone])}>{info.text}</p>
        {canEdit && lease.status !== 'draft' && <RegistrationDialog lease={lease} onDone={onChanged} />}
      </CardContent>
    </Card>
  );
}
