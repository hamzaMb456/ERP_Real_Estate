'use client';

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/store';
import { addDays, todayTunis } from '@/lib/dates';
import {
  isValid,
  MAX_RENT_MONTHS,
  RENT_DURATIONS,
  RENT_HORIZON_DAYS,
  validateContact,
  validateRental,
  validateVisit,
  VISIT_SLOTS,
  visitDays,
  type ContactErrors,
  type FieldProblem,
  type RequestErrorCode,
} from '@/lib/site/request-form';
import {
  submitRentalRequestAction,
  submitVisitRequestAction,
  takenVisitSlotsAction,
  type RequestResult,
  type TakenSlot,
} from '@/lib/site/request-actions';
import type { PublicListing } from '@/lib/site/listings-queries';
import { useClientSession } from '@/components/site/account-menu';
import { cn } from '@/lib/utils';

export type RequestKind = 'rent' | 'visit';

const CHIP =
  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40';
const CHIP_OFF = 'border-border bg-background text-foreground hover:border-primary/40';
const CHIP_ON = 'border-primary bg-primary text-primary-foreground';

/** « lun. 26 oct. » for a day of the visit picker, written in the interface language. */
const dayLabel = (iso: string): string =>
  new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function Problem({ id, problem, copy }: { id: string; problem: FieldProblem | undefined; copy: { required: string; invalid: string } }) {
  if (!problem) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-destructive">
      {copy[problem]}
    </p>
  );
}

/**
 * Request form of the unit page, opened from the booking card: a rental request (start date, duration) or a visit
 * request (day, half-hour slot), then the visitor's contact. When the visitor is signed in, the contact is prefilled
 * from their session and the server action receives the JWT so the database can verify they are logged in.
 * Everything is validated here to guide the visitor and again on the server; the database has the last word. A hidden
 * field catches bots.
 */
export function RequestDialog({
  kind,
  listing,
  open,
  onOpenChange,
  onSubmitted,
}: {
  kind: RequestKind;
  listing: PublicListing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the server accepted the request, so the booking card can disable its button(s) right away. */
  onSubmitted?: (kind: RequestKind) => void;
}) {
  const { t, dir } = useI18n();
  const copy = t.site.request;
  const formId = useId();
  const isRent = kind === 'rent';
  const today = useMemo(() => todayTunis(), []);
  const days = useMemo(() => visitDays(today), [today]);

  // Prefill from the visitor's session when they are signed in.
  const { token, name: sessionName, email: sessionEmail } = useClientSession();

  const [contact, setContact] = useState({ fullName: sessionName ?? '', phone: '', email: sessionEmail ?? '', message: '' });
  const [website, setWebsite] = useState('');
  const [startDate, setStartDate] = useState('');
  const [months, setMonths] = useState<number>(12);
  const [customMonths, setCustomMonths] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [taken, setTaken] = useState<TakenSlot[]>([]);
  const [errors, setErrors] = useState<ContactErrors & { startDate?: FieldProblem; months?: FieldProblem; date?: FieldProblem; time?: FieldProblem }>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);

  // The slots already confirmed for this unit, read when the visit form opens.
  useEffect(() => {
    if (!open || isRent) return;
    let active = true;
    void takenVisitSlotsAction(listing.id).then((slots) => active && setTaken(slots));
    return () => {
      active = false;
    };
  }, [open, isRent, listing.id]);

  const isTaken = (slotTime: string) => taken.some((slot) => slot.date === date && slot.time === slotTime);

  const setField = (field: keyof typeof contact) => (value: string) => setContact((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      ...validateContact(contact),
      ...(isRent ? validateRental({ startDate, months }, today) : validateVisit({ date, time }, today)),
    };
    setErrors(found);
    setFailure(null);
    if (!isValid(found)) return;
    setSubmitting(true);
    let result: RequestResult;
    try {
      // Pass the JWT so the server action can forward it to the database function: the function raises
      // REQUEST_LOGIN_REQUIRED when no session variable is present (migration 0009).
      const accessToken = token ?? undefined;
      result = isRent
        ? await submitRentalRequestAction({ unitId: listing.id, startDate, months, ...contact, website, accessToken })
        : await submitVisitRequestAction({ unitId: listing.id, date, time, ...contact, website, accessToken });
    } catch {
      result = { ok: false, code: 'unknown' };
    }
    setSubmitting(false);
    if (result.ok) {
      setSentFor(contact.fullName.trim());
      onSubmitted?.(kind);
      return;
    }
    setFailure(result.code);
    // A slot taken meanwhile: show it as taken and let the visitor pick another.
    if (result.code === 'slot_taken') {
      setTaken((current) => [...current, { date, time }]);
      setTime('');
    }
  };

  const chooseMonths = (value: number) => {
    setMonths(value);
    setCustomMonths('');
  };

  const customChange = (value: string) => {
    setCustomMonths(value);
    setMonths(value === '' ? Number.NaN : Number(value));
  };

  const fieldProps = (name: string, problem: FieldProblem | undefined) => ({
    id: `${formId}-${name}`,
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': problem ? `${formId}-${name}-problem` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="site-root max-h-[92dvh] min-w-0 gap-5 overflow-x-hidden overflow-y-auto sm:max-w-lg" dir={dir}>
        {sentFor !== null ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-6" aria-hidden="true" />
            </span>
            <DialogTitle className="font-heading-site text-xl">{copy.sentTitle}</DialogTitle>
            <DialogDescription>{isRent ? copy.sentRent(sentFor) : copy.sentVisit(sentFor)}</DialogDescription>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              {copy.close}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading-site text-xl">{isRent ? copy.rentTitle : copy.visitTitle}</DialogTitle>
              <DialogDescription>{isRent ? copy.rentIntro : copy.visitIntro}</DialogDescription>
              <p className="text-sm font-medium text-foreground">{listing.title}</p>
            </DialogHeader>

            <form onSubmit={submit} noValidate className="min-w-0 space-y-5">
              {isRent ? (
                <>
                  <div>
                    <Label htmlFor={`${formId}-startDate`}>{copy.startDate}</Label>
                    <Input
                      {...fieldProps('startDate', errors.startDate)}
                      type="date"
                      dir="ltr"
                      min={today}
                      max={addDays(today, RENT_HORIZON_DAYS)}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-1.5"
                    />
                    <Problem id={`${formId}-startDate-problem`} problem={errors.startDate} copy={copy.problems} />
                  </div>
                  <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-sm font-medium">{copy.duration}</legend>
                    <div className="flex flex-wrap gap-2">
                      {RENT_DURATIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={customMonths === '' && months === value}
                          onClick={() => chooseMonths(value)}
                          className={cn(CHIP, customMonths === '' && months === value ? CHIP_ON : CHIP_OFF)}
                        >
                          {copy.months(value)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor={`${formId}-customMonths`} className="text-xs font-normal text-muted-foreground">
                        {copy.otherDuration}
                      </Label>
                      <Input
                        id={`${formId}-customMonths`}
                        type="number"
                        inputMode="numeric"
                        dir="ltr"
                        min={1}
                        max={MAX_RENT_MONTHS}
                        value={customMonths}
                        onChange={(event) => customChange(event.target.value)}
                        className="h-8 w-20"
                      />
                    </div>
                    <Problem id={`${formId}-months-problem`} problem={errors.months} copy={copy.problems} />
                  </fieldset>
                </>
              ) : (
                <>
                  <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-sm font-medium">{copy.day}</legend>
                    <div className="flex gap-2 overflow-x-auto pb-2" role="group">
                      {days.map((day) => (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={date === day}
                          onClick={() => {
                            setDate(day);
                            setTime('');
                          }}
                          className={cn(CHIP, 'shrink-0', date === day ? CHIP_ON : CHIP_OFF)}
                        >
                          {dayLabel(day)}
                        </button>
                      ))}
                    </div>
                    <Problem id={`${formId}-date-problem`} problem={errors.date} copy={copy.problems} />
                  </fieldset>
                  <fieldset disabled={date === ''} className="min-w-0">
                    <legend className="mb-1.5 text-sm font-medium">{copy.time}</legend>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group">
                      {VISIT_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          dir="ltr"
                          disabled={date === '' || isTaken(slot)}
                          title={isTaken(slot) ? copy.taken : undefined}
                          aria-pressed={time === slot}
                          onClick={() => setTime(slot)}
                          className={cn(CHIP, 'px-2 tabular-nums', time === slot ? CHIP_ON : CHIP_OFF, isTaken(slot) && 'line-through')}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    <Problem id={`${formId}-time-problem`} problem={errors.time} copy={copy.problems} />
                  </fieldset>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor={`${formId}-fullName`}>{copy.fullName}</Label>
                  <Input
                    {...fieldProps('fullName', errors.fullName)}
                    autoComplete="name"
                    maxLength={120}
                    value={contact.fullName}
                    onChange={(event) => setField('fullName')(event.target.value)}
                    className="mt-1.5"
                  />
                  <Problem id={`${formId}-fullName-problem`} problem={errors.fullName} copy={copy.problems} />
                </div>
                <div>
                  <Label htmlFor={`${formId}-phone`}>{copy.phone}</Label>
                  <Input
                    {...fieldProps('phone', errors.phone)}
                    type="tel"
                    dir="ltr"
                    autoComplete="tel"
                    maxLength={25}
                    value={contact.phone}
                    onChange={(event) => setField('phone')(event.target.value)}
                    className="mt-1.5"
                  />
                  <Problem id={`${formId}-phone-problem`} problem={errors.phone} copy={copy.problems} />
                </div>
                <div>
                  <Label htmlFor={`${formId}-email`}>{copy.email}</Label>
                  <Input
                    {...fieldProps('email', errors.email)}
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    maxLength={200}
                    value={contact.email}
                    onChange={(event) => setField('email')(event.target.value)}
                    className="mt-1.5"
                  />
                  <Problem id={`${formId}-email-problem`} problem={errors.email} copy={copy.problems} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`${formId}-message`}>{copy.message}</Label>
                  <Textarea
                    {...fieldProps('message', errors.message)}
                    maxLength={2000}
                    placeholder={copy.messagePlaceholder}
                    value={contact.message}
                    onChange={(event) => setField('message')(event.target.value)}
                    className="mt-1.5"
                  />
                  <Problem id={`${formId}-message-problem`} problem={errors.message} copy={copy.problems} />
                </div>
              </div>

              {/* Honeypot: invisible and unreachable for people, tempting for bots. */}
              <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                </label>
              </div>

              {failure !== null && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                  {copy.errors[failure]}
                </p>
              )}

              <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 data-icon="inline-start" />
                    {copy.sending}
                  </>
                ) : (
                  copy.submit
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
