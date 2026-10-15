'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Pulse } from '@/components/motion/primitives';
import { ContactPicker } from '@/components/ownership/contact-picker';
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatPercent, todayIso } from '@/lib/ownership';

const ADD_OWNERSHIP = `
  mutation AddOwnership($object: ownerships_insert_input!) {
    insert_ownerships_one(object: $object) { id }
  }
`;

type Props = { unitId: string; remaining: number; onDone: () => void };

export function AddCoOwnerDialog({ unitId, remaining, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const full = remaining <= 0.001;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={full} title={full ? 'Les parts atteignent déjà 100 %' : undefined}>
          <UserPlus data-icon="inline-start" />
          Ajouter un copropriétaire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un copropriétaire</DialogTitle>
          <DialogDescription>Part encore libre : {formatPercent(remaining)}.</DialogDescription>
        </DialogHeader>
        <CoOwnerForm
          unitId={unitId}
          remaining={remaining}
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

function CoOwnerForm({ unitId, remaining, onCancel, onDone }: { unitId: string; remaining: number; onCancel: () => void; onDone: () => void }) {
  const contacts = useContactOptions();
  const [contactId, setContactId] = useState<string | null>(null);
  const [share, setShare] = useState(Math.round(remaining * 100) / 100);
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contactId) return setError('Choisissez un contact.');
    if (!(share > 0) || share > remaining + 0.001) return setError(`La part doit être comprise entre 0 et ${formatPercent(remaining)}.`);
    setError(null);
    setSaving(true);
    try {
      await graphql(ADD_OWNERSHIP, { object: { unit_id: unitId, contact_id: contactId, share_percent: share, starts_on: date } });
      toast.success('Copropriétaire ajouté');
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
        <FieldLabel htmlFor="coowner-contact">Contact</FieldLabel>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement des contacts…</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">Impossible de charger les contacts : {contacts.message}</p>}
        {contacts.status === 'success' && (
          <ContactPicker id="coowner-contact" options={contacts.data} value={contactId} onChange={setContactId} invalid={error !== null && !contactId} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="coowner-share">Part</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="coowner-share"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={Number.isFinite(share) ? share : ''}
              onChange={(event) => setShare(event.target.valueAsNumber)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="coowner-date">À partir du</FieldLabel>
          <Input id="coowner-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <FieldDescription>Pour remplacer un propriétaire, utilisez plutôt « Transférer la propriété ».</FieldDescription>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Ajouter
        </Button>
      </DialogFooter>
    </form>
  );
}
