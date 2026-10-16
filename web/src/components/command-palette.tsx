'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { graphql } from '@/lib/graphql';
import { useT } from '@/i18n/provider';
import type { Messages } from '@/i18n/messages';
import { NAVIGATION } from '@/lib/navigation';

type ContactHit = { id: string; full_name: string };

function pagesOf(nav: Messages['nav']) {
  return NAVIGATION.flatMap((item) =>
    item.children
      ? item.children.map((child) => ({
          label: nav.items[item.key] + ' › ' + nav.items[child.key],
          href: child.href,
          icon: item.icon,
        }))
      : [{ label: nav.items[item.key], href: item.href, icon: item.icon }],
  );
}

export function CommandPalette() {
  const router = useRouter();
  const t = useT();
  const pages = pagesOf(t.nav);
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactHit[]>([]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    graphql<{ contacts: ContactHit[] }>('query { contacts(order_by: { full_name: asc }, limit: 200) { id full_name } }')
      .then((data) => active && setContacts(data.contacts))
      .catch(() => active && setContacts([]));
    return () => {
      active = false;
    };
  }, [open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden w-64 justify-between font-normal text-muted-foreground md:flex"
        aria-label={t.shell.command.search}
      >
        <span className="flex items-center gap-2">
          <Search className="size-3.5" />
          {t.shell.command.searchButton}
        </span>
        <kbd dir="ltr" className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t.shell.command.search}>
        <Search />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title={t.shell.command.title} description={t.shell.command.description}>
        <CommandInput placeholder={t.shell.command.placeholder} />
        <CommandList>
          <CommandEmpty>{t.common.noResults}</CommandEmpty>
          <CommandGroup heading={t.shell.command.actions}>
            <CommandItem onSelect={() => go('/contacts/nouveau')}>
              <Plus />
              {t.shell.command.addContact}
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t.shell.command.pages}>
            {pages.map((entry) => {
              const Icon = entry.icon;
              return (
                <CommandItem key={entry.href + entry.label} value={entry.label} onSelect={() => go(entry.href)}>
                  <Icon />
                  {entry.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {contacts.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t.shell.command.contacts}>
                {contacts.map((contact) => (
                  <CommandItem key={contact.id} value={'contact ' + contact.full_name} onSelect={() => go('/contacts/' + contact.id)}>
                    <User />
                    {contact.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
