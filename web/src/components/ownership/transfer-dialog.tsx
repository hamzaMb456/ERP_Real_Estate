'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatDateFr, planTransfer, todayIso, type NewOwner, type OwnershipRow } from '@/lib/ownership';

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
      toast.success(unitIds.length > 1 ? `Propriétaire défini pour ${unitIds.length} unités` : 'Propriété enregistrée', {
        description: 'À partir du ' + formatDateFr(date),
      });
      onDone();
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field>
        <FieldLabel htmlFor="transfer-date">À partir du</FieldLabel>
        <Input id="transfer-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-48" />
        <FieldDescription>Les propriétaires actuels cessent de détenir l’unité la veille de cette date.</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Propriétaires à partir de cette date</FieldLegend>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement des contacts…</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">Impossible de charger les contacts : {contacts.message}</p>}
        {contacts.status === 'success' && <OwnersEditor value={owners} onChange={setOwners} options={contacts.data} />}
      </FieldSet>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving || !date || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
