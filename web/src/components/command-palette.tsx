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
import { NAVIGATION } from '@/lib/navigation';

type ContactHit = { id: string; full_name: string };

const PAGES = NAVIGATION.flatMap((item) =>
  item.children
    ? item.children.map((child) => ({ label: item.label + ' › ' + child.label, href: child.href, icon: item.icon }))
    : [{ label: item.label, href: item.href, icon: item.icon }],
);

export function CommandPalette() {
  const router = useRouter();
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
    if (!open || contacts.length > 0) return;
    graphql<{ contacts: ContactHit[] }>('query { contacts(order_by: { full_name: asc }, limit: 50) { id full_name } }')
      .then((data) => setContacts(data.contacts))
      .catch(() => setContacts([]));
  }, [open, contacts.length]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden w-64 justify-between font-normal text-muted-foreground md:flex"
        aria-label="Ouvrir la recherche"
      >
        <span className="flex items-center gap-2">
          <Search className="size-3.5" />
          Rechercher…
        </span>
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir la recherche">
        <Search />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Recherche" description="Aller à une page ou un contact">
        <CommandInput placeholder="Rechercher une page, un contact…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go('/contacts/nouveau')}>
              <Plus />
              Ajouter un contact
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {PAGES.map((entry) => {
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
              <CommandGroup heading="Contacts">
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
