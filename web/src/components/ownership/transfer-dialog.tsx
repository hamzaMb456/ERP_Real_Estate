'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { FieldHelp, FieldLabelWithHelp } from '@/components/field-help';
import { Pulse } from '@/components/motion/primitives';
import { OwnersEditor } from '@/components/ownership/owners-editor';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatDate, planTransfer, todayIso, type NewOwner, type OwnershipRow } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
const TRANSFER = `
  mutation TransferOwnership($endIds: [uuid!]!, $endOn: date!, $objects: [ownerships_insert_input!]!) {
    update_ownerships(where: { id: { _in: $endIds } }, _set: { ends_on: $endOn }) { affected_rows }
    insert_ownerships(objects: $objects) { affected_rows }
  }
`;

type Props = {
  unitIds: string[];
  rows: OwnershipRow[];
  title: string;
  description: string;
  trigger: ReactNode;
  onDone: () => void;
};

export function TransferDialog({ unitIds, rows, title, description, trigger, onDone }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <TransferForm
          unitIds={unitIds}
          rows={rows}
          onCancel={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({
  unitIds,
  rows,
  onCancel,
  onDone,
}: {
  unitIds: string[];
  rows: OwnershipRow[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const contacts = useContactOptions();
  const [date, setDate] = useState(todayIso());
  const [owners, setOwners] = useState<NewOwner[]>([{ contactId: null, sharePercent: 100 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const plan = planTransfer(unitIds, rows, date, owners);
    if ('error' in plan) {
      setError(plan.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await graphql(TRANSFER, plan);
      toast.success(unitIds.length > 1 ? t.ownership.transfer.definedMany(unitIds.length) : t.ownership.transfer.saved, {
        description: t.common.from(formatDate(date)),
      });
      onDone();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field>
        <FieldLabelWithHelp htmlFor="transfer-date" help={t.ownership.transfer.dateHelp}>
          {t.ownership.transfer.date}
        </FieldLabelWithHelp>
        <Input id="transfer-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-48" />
        <FieldDescription>{t.ownership.transfer.dateHint}</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend variant="label" className="flex items-center gap-1.5">
          {t.ownership.transfer.owners}
          <FieldHelp>{t.ownership.transfer.ownersHelp}</FieldHelp>
        </FieldLegend>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">{t.ownership.coOwner.loadingContacts}</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">{t.ownership.coOwner.contactsError(contacts.message)}</p>}
        {contacts.status === 'success' && <OwnersEditor value={owners} onChange={setOwners} options={contacts.data} />}
      </FieldSet>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving || !date || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" />}
          {t.common.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
