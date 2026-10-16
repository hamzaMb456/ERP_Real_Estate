'use client';

import { Plus, X } from 'lucide-react';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { formatPercent, type NewOwner } from '@/lib/ownership';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
type Props = { value: NewOwner[]; onChange: (next: NewOwner[]) => void; options: ContactOption[] };

export function OwnersEditor({ value, onChange, options }: Props) {
  const t = useT();
  const total = value.reduce((sum, owner) => sum + (Number.isFinite(owner.sharePercent) ? owner.sharePercent : 0), 0);
  const complete = Math.abs(total - 100) <= 0.001;
  const chosen = value.map((owner) => owner.contactId).filter((id): id is string => id !== null);

  const update = (index: number, patch: Partial<NewOwner>) =>
    onChange(value.map((owner, position) => (position === index ? { ...owner, ...patch } : owner)));

  return (
    <div className="space-y-3">
      {value.map((owner, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ContactPicker
              id={'owner-' + index}
              options={options}
              value={owner.contactId}
              excludeIds={chosen}
              onChange={(contactId) => update(index, { contactId })}
            />
          </div>
          <InputGroup className="w-28 shrink-0">
            <InputGroupInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              aria-label={t.ownership.editor.shareAria(index + 1)}
              value={Number.isFinite(owner.sharePercent) ? owner.sharePercent : ''}
              onChange={(event) => update(index, { sharePercent: event.target.valueAsNumber })}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.ownership.editor.removeRow(index + 1)}
            disabled={value.length === 1}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { contactId: null, sharePercent: Math.max(0, Math.round((100 - total) * 100) / 100) }])}
        >
          <Plus data-icon="inline-start" />
          {t.ownership.editor.addCoOwner}
        </Button>
        <p aria-live="polite" className={cn('text-sm font-medium tabular-nums', complete ? 'text-success' : 'text-destructive')}>
          {t.ownership.editor.total(formatPercent(total))}
        </p>
      </div>
    </div>
  );
}
