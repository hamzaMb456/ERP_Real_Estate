'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { getMessages } from '@/i18n/store';
import { useT } from '@/i18n/provider';
export type ContactOption = { id: string; full_name: string; kind: 'person' | 'company'; is_organization: boolean };

export function optionLabel(option: ContactOption): string {
  return option.is_organization ? option.full_name + getMessages().ownership.picker.orgSuffix : option.full_name;
}

type Props = {
  id?: string;
  options: ContactOption[];
  value: string | null;
  onChange: (id: string) => void;
  excludeIds?: string[];
  invalid?: boolean;
};

export function ContactPicker({ id, options, value, onChange, excludeIds = [], invalid = false }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  const available = options.filter((option) => option.id === value || !excludeIds.includes(option.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? optionLabel(selected) : t.ownership.picker.choose}
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t.ownership.picker.search} />
          <CommandList>
            <CommandEmpty>{t.ownership.picker.none}</CommandEmpty>
            <CommandGroup>
              {available.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.full_name + ' ' + option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(option.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  {optionLabel(option)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-1">
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link href="/contacts/nouveau" target="_blank">
                <Plus data-icon="inline-start" />
                {t.ownership.picker.newContact}
              </Link>
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
