'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { useT } from '@/i18n/provider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Small ⓘ button placed after a field label. Opens a popover (tap, click or Enter/Space) with the explanation.
 * The accessible name is constant (« Aide ») so that getByLabel('<field label>') keeps matching only the field itself.
 */
export function FieldHelp({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t.common.help}
          className="size-5 shrink-0 rounded-full text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-sm">
        {children}
      </PopoverContent>
    </Popover>
  );
}

type FieldLabelWithHelpProps = { htmlFor?: string; help: ReactNode; children: ReactNode };

/** A field label followed by its ⓘ help button. The button sits beside the label, not inside it, so clicking it never focuses the field. */
export function FieldLabelWithHelp({ htmlFor, help, children }: FieldLabelWithHelpProps) {
  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <FieldHelp>{help}</FieldHelp>
    </div>
  );
}
