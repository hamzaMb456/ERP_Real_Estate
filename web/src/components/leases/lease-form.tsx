'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LeasePartiesField } from '@/components/leases/lease-parties-field';
import { LeaseUnitsField, type UnitOption } from '@/components/leases/lease-units-field';
import { Pulse } from '@/components/motion/primitives';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addDays, todayTunis } from '@/lib/dates';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import type { LeaseDraftInput, LeaseUnitInput } from '@/lib/lease-types';
import { buildLeaseObjects, validateLeaseDraft } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const UNITS_QUERY = `
  query LeaseFormUnits($keep: [uuid!]!) {
    units(
      where: { archived_at: { _is_null: true }, property: { archived_at: { _is_null: true } }, _or: [{ status: { _eq: "vacant" } }, { id: { _in: $keep } }] }
      order_by: [{ property: { name: asc } }, { code: asc }]
    ) { id code rent_amount property { id name } }
  }
`;

const CREATE_LEASE = `
  mutation CreateLease($lease: leases_insert_input!, $units: [lease_units_insert_input!]!, $parties: [lease_parties_insert_input!]!, $rents: [lease_rents_insert_input!]!) {
    insert_leases_one(object: $lease) { id }
    insert_lease_units(objects: $units) { affected_rows }
    insert_lease_parties(objects: $parties) { affected_rows }
    insert_lease_rents(objects: $rents) { affected_rows }
  }
`;

const UPDATE_DRAFT = `
  mutation UpdateDraftLease($id: uuid!, $set: leases_set_input!, $units: [lease_units_insert_input!]!, $parties: [lease_parties_insert_input!]!, $rents: [lease_rents_insert_input!]!) {
    delete_lease_parties(where: { lease_id: { _eq: $id } }) { affected_rows }
    delete_lease_units(where: { lease_id: { _eq: $id } }) { affected_rows }
    update_leases_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    insert_lease_units(objects: $units) { affected_rows }
    insert_lease_parties(objects: $parties) { affected_rows }
    insert_lease_rents(objects: $rents) { affected_rows }
  }
`;

export type LeaseFormInitial = {
  id: string;
  startDate: string;
  endDate: string;
  paymentDay: string;
  depositAmount: string;
  units: LeaseUnitInput[];
  renters: string[];
  guarantors: string[];
};

type Props = { initial?: LeaseFormInitial; presetUnitId?: string };

/** Loads the free units and the contacts, then shows the form (its state starts from what was loaded). */
export function LeaseForm({ initial, presetUnitId }: Props) {
  const keep = [...(initial?.units.map((unit) => unit.unitId) ?? []), ...(presetUnitId ? [presetUnitId] : [])];
  const units = useGraphql<{ units: UnitOption[] }>(UNITS_QUERY, { keep });
  const contacts = useContactOptions();

  if (units.status === 'loading' || contacts.status === 'loading') {
    return <Pulse className="text-sm text-muted-foreground">Chargement du formulaire…</Pulse>;
  }
  if (units.status === 'error' || contacts.status === 'error') {
    const message = units.status === 'error' ? units.message : contacts.status === 'error' ? contacts.message : '';
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Impossible de charger le formulaire : {message}
      </p>
    );
  }
  return <LeaseFormBody units={units.data.units} contacts={contacts.data} initial={initial} presetUnitId={presetUnitId} />;
}

function LeaseFormBody({ units, contacts, initial, presetUnitId }: { units: UnitOption[]; contacts: ContactOption[] } & Props) {
  const router = useRouter();
  const [state, setState] = useState<LeaseDraftInput>(() => {
    if (initial) {
      return {
        startDate: initial.startDate,
        endDate: initial.endDate,
        paymentDay: initial.paymentDay,
        depositAmount: initial.depositAmount,
        units: initial.units,
        renters: initial.renters,
        guarantors: initial.guarantors,
      };
    }
    const today = todayTunis();
    const preset = units.find((unit) => unit.id === presetUnitId);
    return {
      startDate: today,
      endDate: addDays(today, 364),
      paymentDay: '1',
      depositAmount: '',
      units: preset ? [{ unitId: preset.id, rent: preset.rent_amount === null ? '' : String(Number(preset.rent_amount)), charges: '' }] : [],
      renters: [null],
      guarantors: [],
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<LeaseDraftInput>) => setState((current) => ({ ...current, ...next }));
  const taken = [...state.renters, ...state.guarantors].filter((id): id is string => id !== null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateLeaseDraft(state);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const id = initial?.id ?? crypto.randomUUID();
      const built = buildLeaseObjects(id, state);
      if (initial) {
        await graphql(UPDATE_DRAFT, { id, set: built.set, units: built.units, parties: built.parties, rents: built.rents });
      } else {
        await graphql(CREATE_LEASE, { lease: { id, ...built.set }, units: built.units, parties: built.parties, rents: built.rents });
      }
      toast.success('Brouillon enregistré', { description: 'Activez le bail une fois signé.' });
      router.push('/baux/' + id);
    } catch (caught) {
      setError(toFrenchError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Durée et conditions</CardTitle>
          <CardDescription>Le loyer mensuel est payable le jour choisi (de 1 à 28).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="lease-start">Début du bail</FieldLabel>
            <Input id="lease-start" type="date" required value={state.startDate} onChange={(event) => patch({ startDate: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-end">Fin du bail</FieldLabel>
            <Input id="lease-end" type="date" required value={state.endDate} onChange={(event) => patch({ endDate: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-day">Jour de paiement</FieldLabel>
            <Input id="lease-day" type="number" min={1} max={28} value={state.paymentDay} onChange={(event) => patch({ paymentDay: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="lease-deposit">Dépôt de garantie (TND)</FieldLabel>
            <Input id="lease-deposit" inputMode="decimal" placeholder="0" value={state.depositAmount} onChange={(event) => patch({ depositAmount: event.target.value })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <LeaseUnitsField options={units} value={state.units} onChange={(value) => patch({ units: value })} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6">
          <LeasePartiesField
            legend="Locataires"
            addLabel="Ajouter un locataire"
            rowLabel="locataire"
            value={state.renters}
            onChange={(value) => patch({ renters: value })}
            options={contacts}
            taken={taken}
            minRows={1}
          />
          <LeasePartiesField
            legend="Garants"
            addLabel="Ajouter un garant"
            rowLabel="garant"
            value={state.guarantors}
            onChange={(value) => patch({ guarantors: value })}
            options={contacts}
            taken={taken}
            minRows={0}
          />
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          Enregistrer le brouillon
        </Button>
      </div>
    </form>
  );
}
