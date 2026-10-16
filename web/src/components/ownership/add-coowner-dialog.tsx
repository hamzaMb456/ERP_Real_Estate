'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { FieldLabelWithHelp } from '@/components/field-help';
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
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatPercent, todayIso } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
const ADD_OWNERSHIP = `
  mutation AddOwnership($object: ownerships_insert_input!) {
    insert_ownerships_one(object: $object) { id }
  }
`;

type Props = { unitId: string; remaining: number; onDone: () => void };

export function AddCoOwnerDialog({ unitId, remaining, onDone }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const full = remaining <= 0.001;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={full} title={full ? t.ownership.coOwner.full : undefined}>
          <UserPlus data-icon="inline-start" />
          {t.ownership.coOwner.title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.ownership.coOwner.title}</DialogTitle>
          <DialogDescription>{t.ownership.coOwner.free(formatPercent(remaining))}</DialogDescription>
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
  const t = useT();
  const contacts = useContactOptions();
  const [contactId, setContactId] = useState<string | null>(null);
  const [share, setShare] = useState(Math.round(remaining * 100) / 100);
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contactId) return setError(t.ownership.coOwner.pickContact);
    if (!(share > 0) || share > remaining + 0.001) return setError(t.ownership.coOwner.shareRange(formatPercent(remaining)));
    setError(null);
    setSaving(true);
    try {
      await graphql(ADD_OWNERSHIP, { object: { unit_id: unitId, contact_id: contactId, share_percent: share, starts_on: date } });
      toast.success(t.ownership.coOwner.added);
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
        <FieldLabelWithHelp htmlFor="coowner-contact" help={t.ownership.coOwner.contactHelp}>
          {t.ownership.coOwner.contact}
        </FieldLabelWithHelp>
        {contacts.status === 'loading' && <Pulse className="text-sm text-muted-foreground">{t.ownership.coOwner.loadingContacts}</Pulse>}
        {contacts.status === 'error' && <p role="alert" className="text-sm text-destructive">{t.ownership.coOwner.contactsError(contacts.message)}</p>}
        {contacts.status === 'success' && (
          <ContactPicker id="coowner-contact" options={contacts.data} value={contactId} onChange={setContactId} invalid={error !== null && !contactId} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabelWithHelp htmlFor="coowner-share" help={t.ownership.coOwner.shareHelp}>
            {t.ownership.coOwner.share}
          </FieldLabelWithHelp>
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
          <FieldLabelWithHelp htmlFor="coowner-date" help={t.ownership.coOwner.fromHelp}>
            {t.ownership.coOwner.from}
          </FieldLabelWithHelp>
          <Input id="coowner-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <FieldDescription>{t.ownership.coOwner.hint}</FieldDescription>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving || contacts.status !== 'success'}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {t.ownership.coOwner.add}
        </Button>
      </DialogFooter>
    </form>
  );
}
