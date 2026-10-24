'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

/** One question of the flow. `fields` are the react-hook-form field names checked before moving on. */
export type FlowStep = {
  id: string;
  title: string;
  help?: string;
  fields?: string[];
  /** Optional questions get a « Passer » button that moves on without checking anything. */
  optional?: boolean;
  children: ReactNode;
};

type Props = {
  steps: FlowStep[];
  /** react-hook-form's `trigger`: validates the given fields (all of them when omitted) and shows their errors. */
  trigger: (names?: string[]) => Promise<boolean>;
  /** Saves the record: `handleSubmit(onValid)`. Called once every question has been checked. */
  onSubmit: () => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  className?: string;
};

/**
 * Asks one question at a time: a progress bar, the question, then Retour / Continuer (Entrée continues). The last
 * question saves. Questions that depend on earlier answers can come and go between renders: the current question is
 * tracked by id, not by position. Every question is validated again on save, and the flow jumps back to the first
 * one with a problem.
 */
export function QuestionFlow({ steps, trigger, onSubmit, onCancel, submitting, submitLabel, className }: Props) {
  const t = useT().properties.flow;
  const [currentId, setCurrentId] = useState(steps[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const found = steps.findIndex((step) => step.id === currentId);
  const index = found === -1 ? 0 : found;
  const step = steps[index];
  const last = index === steps.length - 1;

  // Land on the first text field of each question, so the keyboard keeps working without a click.
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="file"]):not([type="hidden"]), textarea')?.focus();
  }, [step?.id]);

  if (!step) return null;
  const go = (target: number) => setCurrentId(steps[Math.min(Math.max(target, 0), steps.length - 1)].id);

  async function next() {
    if (busy || submitting) return;
    setBusy(true);
    try {
      if (step.fields && step.fields.length > 0 && !(await trigger(step.fields))) return;
      if (!last) {
        go(index + 1);
        return;
      }
      for (let position = 0; position < steps.length; position += 1) {
        const fields = steps[position].fields;
        if (fields && fields.length > 0 && !(await trigger(fields))) {
          go(position);
          return;
        }
      }
      await onSubmit();
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.key !== 'Enter' || event.shiftKey || target.tagName !== 'INPUT') return;
    if (['checkbox', 'radio', 'file', 'button'].includes((target as HTMLInputElement).type)) return;
    event.preventDefault();
    void next();
  }

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className={cn('flex flex-col gap-6', className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span aria-live="polite">{t.counter(index + 1, steps.length)}</span>
          {step.optional && !last && (
            <button type="button" className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => go(index + 1)}>
              {t.skip}
            </button>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label={t.progress}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div key={step.id} ref={bodyRef} onKeyDown={onKeyDown} className="min-h-40 space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
          {step.help && <p className="text-sm text-muted-foreground">{step.help}</p>}
        </div>
        {step.children}
      </div>

      <div className="flex items-center justify-between gap-2">
        {index === 0 ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => go(index - 1)}>
            <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
            {t.back}
          </Button>
        )}
        <Button type="button" onClick={() => void next()} disabled={busy || submitting}>
          {(busy || submitting) && <Loader2 data-icon="inline-start" />}
          {last ? submitLabel : t.next}
        </Button>
      </div>
    </form>
  );
}

type Option<T extends string> = { value: T; label: string };

/** One choice among a few, as large buttons. Picking one never moves on by itself, so a mis-click is harmless. */
export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.value} checked={option.value === value} role="radio" onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

/** Several choices among a few: each button toggles its value. */
export function MultiChips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: readonly T[];
  options: readonly Option<T>[];
  onChange: (value: T[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Chip
            key={option.value}
            checked={checked}
            role="checkbox"
            onClick={() => onChange(checked ? value.filter((item) => item !== option.value) : [...value, option.value])}
          >
            {option.label}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({ checked, role, onClick, children }: { checked: boolean; role: 'radio' | 'checkbox'; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
        checked ? 'border-primary bg-accent text-accent-foreground' : 'border-input hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
