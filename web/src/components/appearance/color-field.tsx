'use client';

import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/provider';
import { normalizeHex } from '@/theme/color';

type Props = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  hint?: string;
  /** Shows the revert button when the colour differs from the palette. */
  overridden?: boolean;
  onRevert?: () => void;
};

/** Native colour picker plus a hex field; the hex field only commits valid codes. */
export function ColorField({ label, value, onChange, hint, overridden, onRevert }: Props) {
  const t = useT();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && normalizeHex(draft) === null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t.appearance.colors.pick(label)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <Input
          id={id}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          value={draft ?? value}
          aria-invalid={invalid || undefined}
          aria-label={`${label} - ${t.appearance.colors.hex}`}
          onChange={(event) => {
            setDraft(event.target.value);
            const hex = normalizeHex(event.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setDraft(null)}
          className="font-mono text-sm uppercase"
        />
        {overridden && onRevert && (
          <Button type="button" variant="ghost" size="icon" aria-label={`${t.appearance.colors.revert}: ${label}`} onClick={onRevert}>
            <RotateCcw />
          </Button>
        )}
      </div>
      {invalid ? (
        <p role="alert" className="text-xs text-destructive">
          {t.appearance.colors.invalidHex}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
