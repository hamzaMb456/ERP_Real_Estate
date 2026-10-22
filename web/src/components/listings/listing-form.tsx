'use client';

import { useId, useState, type FormEvent } from 'react';
import { ExternalLink, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import {
  AMENITIES,
  buildListingFields,
  toFormState,
  validateListing,
  type ListingFormErrors,
  type ListingFormState,
  type ListingKind,
  type ListingRecord,
} from '@/lib/listings';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

const CREATE_LISTING = `
  mutation CreateListing($object: listings_insert_input!) {
    insert_listings_one(object: $object) { id }
  }
`;

const UPDATE_LISTING = `
  mutation UpdateListing($id: uuid!, $set: listings_set_input!) {
    update_listings_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

type Action = 'save' | 'publish' | 'pause';

type Props = {
  unitId: string;
  /** Kinds the unit allows, the preferred one first; a new listing picks among them, an existing one keeps its own. */
  kinds: ListingKind[];
  listing?: ListingRecord;
  onSaved: () => void;
  onCancel?: () => void;
};

/** Money field with the currency as a suffix. */
function MoneyInput({ id, value, invalid, onChange }: { id: string; value: string; invalid: boolean; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <InputGroup>
      <InputGroupInput id={id} inputMode="decimal" placeholder="0" aria-invalid={invalid} aria-describedby={invalid ? id + '-error' : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{t.common.currency}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function ListingForm({ unitId, kinds, listing, onSaved, onCancel }: Props) {
  const t = useT();
  const uid = useId();
  const fieldId = (name: string) => uid + '-' + name;
  const [kind, setKind] = useState<ListingKind>(listing?.kind ?? kinds[0] ?? 'rent');
  const [state, setState] = useState<ListingFormState>(() => toFormState(listing));
  const [errors, setErrors] = useState<ListingFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const status = listing?.status ?? 'draft';
  const patch = (next: Partial<ListingFormState>) => setState((current) => ({ ...current, ...next }));
  const price = kind === 'rent' ? t.listings.form.priceRent : t.listings.form.priceSale;

  async function save(action: 'save' | 'publish') {
    const invalid = validateListing(state, kind);
    setErrors(invalid);
    setError(null);
    if (Object.keys(invalid).length > 0) return;
    setBusy(action);
    try {
      const fields = buildListingFields(state, kind);
      const publish = action === 'publish';
      if (listing) {
        await graphql(UPDATE_LISTING, { id: listing.id, set: publish ? { ...fields, status: 'published' } : fields });
      } else {
        await graphql(CREATE_LISTING, { object: { unit_id: unitId, kind, status: publish ? 'published' : 'draft', ...fields } });
      }
      toast.success(publish ? t.listings.form.publishedToast : listing ? t.listings.form.saved : t.listings.form.created);
      onSaved();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  /** Pausing and closing change the status only: they never depend on the other fields being valid. */
  async function changeStatus(set: Record<string, unknown>, success: string, action: Action | null) {
    if (!listing) return;
    setError(null);
    setBusy(action);
    try {
      await graphql(UPDATE_LISTING, { id: listing.id, set });
      toast.success(success);
      onSaved();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save('save');
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {!listing && kinds.length > 1 && (
        <FieldSet>
          <FieldLegend variant="label">{t.listings.form.kind}</FieldLegend>
          <RadioGroup value={kind} onValueChange={(value) => setKind(value as ListingKind)} className="grid max-w-md grid-cols-2 gap-3">
            {kinds.map((option) => (
              <label
                key={option}
                htmlFor={fieldId('kind-' + option)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                  kind === option ? 'border-primary bg-accent text-accent-foreground' : 'hover:bg-muted',
                )}
              >
                <RadioGroupItem id={fieldId('kind-' + option)} value={option} />
                {t.listings.kinds[option]}
              </label>
            ))}
          </RadioGroup>
        </FieldSet>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.title} className="sm:col-span-2">
          <FieldLabel htmlFor={fieldId('title')}>{t.listings.form.title}</FieldLabel>
          <Input
            id={fieldId('title')}
            required
            placeholder={t.listings.form.titlePlaceholder}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? fieldId('title-error') : undefined}
            value={state.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
          {errors.title && <FieldError id={fieldId('title-error')}>{errors.title}</FieldError>}
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={fieldId('description')}>{t.listings.form.description}</FieldLabel>
          <Textarea id={fieldId('description')} rows={4} value={state.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>

        <Field data-invalid={!!errors.price}>
          <FieldLabel htmlFor={fieldId('price')}>{price}</FieldLabel>
          <MoneyInput id={fieldId('price')} value={state.price} invalid={!!errors.price} onChange={(value) => patch({ price: value })} />
          {errors.price && <FieldError id={fieldId('price-error')}>{errors.price}</FieldError>}
        </Field>

        {kind === 'rent' ? (
          <>
            <Field data-invalid={!!errors.charges}>
              <FieldLabel htmlFor={fieldId('charges')}>{t.listings.form.charges}</FieldLabel>
              <MoneyInput id={fieldId('charges')} value={state.charges} invalid={!!errors.charges} onChange={(value) => patch({ charges: value })} />
              {errors.charges && <FieldError id={fieldId('charges-error')}>{errors.charges}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.depositMonths}>
              <FieldLabel htmlFor={fieldId('deposit-months')}>{t.listings.form.depositMonths}</FieldLabel>
              <Input
                id={fieldId('deposit-months')}
                type="number"
                min={0}
                max={12}
                aria-invalid={!!errors.depositMonths}
                aria-describedby={errors.depositMonths ? fieldId('deposit-months-error') : undefined}
                value={state.depositMonths}
                onChange={(event) => patch({ depositMonths: event.target.value })}
              />
              {errors.depositMonths && <FieldError id={fieldId('deposit-months-error')}>{errors.depositMonths}</FieldError>}
            </Field>
          </>
        ) : (
          <>
            <Field data-invalid={!!errors.reservationDeposit}>
              <FieldLabel htmlFor={fieldId('reservation-deposit')}>{t.listings.form.reservationDeposit}</FieldLabel>
              <MoneyInput id={fieldId('reservation-deposit')} value={state.reservationDeposit} invalid={!!errors.reservationDeposit} onChange={(value) => patch({ reservationDeposit: value })} />
              {errors.reservationDeposit && <FieldError id={fieldId('reservation-deposit-error')}>{errors.reservationDeposit}</FieldError>}
            </Field>
            <Field data-invalid={!!errors.reservationDays}>
              <FieldLabel htmlFor={fieldId('reservation-days')}>{t.listings.form.reservationDays}</FieldLabel>
              <Input
                id={fieldId('reservation-days')}
                type="number"
                min={1}
                max={90}
                aria-invalid={!!errors.reservationDays}
                aria-describedby={errors.reservationDays ? fieldId('reservation-days-error') : undefined}
                value={state.reservationDays}
                onChange={(event) => patch({ reservationDays: event.target.value })}
              />
              {errors.reservationDays && <FieldError id={fieldId('reservation-days-error')}>{errors.reservationDays}</FieldError>}
            </Field>
          </>
        )}

        <Field>
          <FieldLabel htmlFor={fieldId('available-from')}>{t.listings.form.availableFrom}</FieldLabel>
          <Input id={fieldId('available-from')} type="date" value={state.availableFrom} onChange={(event) => patch({ availableFrom: event.target.value })} />
        </Field>

        <Field data-invalid={!!errors.virtualTourUrl}>
          <FieldLabel htmlFor={fieldId('tour')}>{t.listings.form.virtualTour}</FieldLabel>
          <Input
            id={fieldId('tour')}
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder={t.listings.form.virtualTourPlaceholder}
            aria-invalid={!!errors.virtualTourUrl}
            aria-describedby={errors.virtualTourUrl ? fieldId('tour-error') : undefined}
            value={state.virtualTourUrl}
            onChange={(event) => patch({ virtualTourUrl: event.target.value })}
          />
          {errors.virtualTourUrl && <FieldError id={fieldId('tour-error')}>{errors.virtualTourUrl}</FieldError>}
        </Field>
      </div>

      <FieldSet>
        <FieldLegend variant="label">{t.listings.form.amenities}</FieldLegend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={state.furnished} onCheckedChange={(checked) => patch({ furnished: checked === true })} />
            {t.listings.form.furnished}
          </label>
          {AMENITIES.map((amenity) => (
            <label key={amenity} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={state.amenities.includes(amenity)}
                onCheckedChange={(checked) =>
                  patch({ amenities: checked === true ? [...state.amenities, amenity] : state.amenities.filter((value) => value !== amenity) })
                }
              />
              {t.listings.amenities[amenity]}
            </label>
          ))}
        </div>
      </FieldSet>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {listing && status !== 'closed' && (
          <Button type="button" variant="ghost" className="me-auto text-destructive" disabled={busy !== null} onClick={() => setConfirmClose(true)}>
            {t.listings.form.close}
          </Button>
        )}
        {!listing && onCancel && (
          <Button type="button" variant="ghost" disabled={busy !== null} onClick={onCancel}>
            {t.listings.form.cancel}
          </Button>
        )}
        {listing && status === 'published' && (
          <>
            <Button asChild variant="ghost">
              <a href={'/logement/' + listing.id} target="_blank" rel="noopener noreferrer">
                <ExternalLink data-icon="inline-start" className="rtl:-scale-x-100" />
                {t.listings.card.viewOnSite}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void changeStatus({ status: 'paused' }, t.listings.form.pausedToast, 'pause')}
            >
              {busy === 'pause' && <Loader2 data-icon="inline-start" />}
              {t.listings.form.pause}
            </Button>
          </>
        )}
        <Button type="submit" variant="outline" disabled={busy !== null}>
          {busy === 'save' && <Loader2 data-icon="inline-start" />}
          {t.listings.form.save}
        </Button>
        {status !== 'published' && (
          <Button type="button" disabled={busy !== null} onClick={() => void save('publish')}>
            {busy === 'publish' && <Loader2 data-icon="inline-start" />}
            {t.listings.form.publish}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t.listings.form.closeTitle}
        description={t.listings.form.closeBody}
        confirmLabel={t.listings.form.closeConfirm}
        onConfirm={() => changeStatus({ status: 'closed', closed_reason: 'manual' }, t.listings.form.closedToast, null)}
      />
    </form>
  );
}
