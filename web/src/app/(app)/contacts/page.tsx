'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ChevronRight, Plus, Search, UserX } from 'lucide-react';
import { CONTACT_ROLES, RoleBadge, type ContactRole } from '@/components/domain/badges';
import { SkeletonList, Stagger, StaggerItem, staggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldHelp } from '@/components/field-help';
import { Label } from '@/components/ui/label';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const CONTACTS_QUERY = `
  query Contacts {
    contacts(order_by: { full_name: asc }, limit: 500) {
      id
      kind
      full_name
      email
      phone
      archived_at
      is_organization
      roles { role }
      current_ownerships_aggregate { aggregate { count } }
    }
  }
`;

type Contact = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  archived_at: string | null;
  is_organization: boolean;
  roles: { role: ContactRole }[];
  current_ownerships_aggregate: { aggregate: { count: number } | null };
};

const PAGE_SIZE = 10;
const MotionRow = motion.create(TableRow);

const rowsContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

function initials(name: string): string {
  return name
    .replace(/^(M\.|Mme|Mlle|Sté|SARL)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ContactsPage() {
  const t = useT();
  const result = useGraphql<{ contacts: Contact[] }>(CONTACTS_QUERY);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContactRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);

  const loaded = result.status === 'success' ? result.data.contacts : [];
  const all = loaded.filter((contact) => showArchived || !contact.archived_at);
  const countFor = (role: ContactRole) => all.filter((contact) => contact.roles.some((item) => item.role === role)).length;
  const needle = search.trim().toLowerCase();
  const filtered = all.filter(
    (contact) =>
      (roleFilter === 'all' || contact.roles.some((item) => item.role === roleFilter)) &&
      (needle === '' ||
        contact.full_name.toLowerCase().includes(needle) ||
        (contact.email ?? '').toLowerCase().includes(needle) ||
        (contact.phone ?? '').includes(needle)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title={t.contacts.list.title}
          description={t.contacts.list.description}
          actions={
            <Button asChild>
              <Link href="/contacts/nouveau">
                <Plus data-icon="inline-start" />
                {t.contacts.list.add}
              </Link>
            </Button>
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <Tabs
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value as ContactRole | 'all');
                setPage(1);
              }}
            >
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="all">{t.contacts.list.tabAll(all.length)}</TabsTrigger>
                {CONTACT_ROLES.map((role) => (
                  <TabsTrigger key={role.value} value={role.value}>
                    {t.contacts.list.tabRole(t.contacts.rolesPlural[role.value], countFor(role.value))}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="contacts-archived"
                  checked={showArchived}
                  onCheckedChange={(checked) => {
                    setShowArchived(checked === true);
                    setPage(1);
                  }}
                />
                <Label htmlFor="contacts-archived" className="text-sm font-normal text-muted-foreground">
                  {t.contacts.list.showArchived}
                </Label>
                <FieldHelp>{t.contacts.list.archivedHelp}</FieldHelp>
              </div>
            <InputGroup className="md:w-72">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t.contacts.list.searchPlaceholder}
                aria-label={t.contacts.list.searchLabel}
              />
            </InputGroup>
            </div>
          </div>

          {result.status === 'loading' && (
            <SkeletonList count={5} className="space-y-2 p-4" itemClassName="h-12 rounded-lg bg-muted" label={t.contacts.list.loading} />
          )}
          {result.status === 'error' && (
            <p role="alert" className="m-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {t.contacts.list.loadError(result.message)}
            </p>
          )}

          {result.status === 'success' && (
            <>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="ps-4">{t.contacts.list.colContact}</TableHead>
                      <TableHead>{t.contacts.list.colRoles}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t.contacts.list.colEmail}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t.contacts.list.colPhone}</TableHead>
                      <TableHead className="hidden text-end md:table-cell">{t.contacts.list.colUnits}</TableHead>
                      <TableHead className="pe-4 text-end">
                        <span className="sr-only">{t.common.actions}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <motion.tbody
                    key={roleFilter + currentPage}
                    variants={rowsContainer}
                    initial="hidden"
                    animate="visible"
                    className="[&_tr:last-child]:border-0"
                  >
                    {visible.map((contact) => {
                      const primary = CONTACT_ROLES.find((role) => contact.roles.some((item) => item.role === role.value));
                      return (
                        <MotionRow key={contact.id} variants={staggerItem} className="group">
                          <TableCell className="ps-4">
                            <Link href={'/contacts/' + contact.id} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                              <Avatar className="size-9">
                                <AvatarFallback className={primary?.avatar + ' text-xs font-semibold'}>
                                  {initials(contact.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0">
                                <span className="block truncate font-medium group-hover:text-primary">{contact.full_name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {t.contacts.kinds[contact.kind]}
                                  {contact.is_organization && t.contacts.orgSuffix}
                                  {contact.archived_at && t.contacts.archivedSuffix}
                                </span>
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {contact.roles.map((item) => (
                                <RoleBadge key={item.role} role={item.role} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">{contact.email ?? '—'}</TableCell>
                          <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">{contact.phone ?? '—'}</TableCell>
                          <TableCell className="hidden text-end tabular-nums md:table-cell">
                            {contact.current_ownerships_aggregate.aggregate?.count || '—'}
                          </TableCell>
                          <TableCell className="pe-4 text-end">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={'/contacts/' + contact.id} aria-label={t.contacts.list.openRecord(contact.full_name)}>
                                {t.contacts.list.view}
                                <ChevronRight data-icon="inline-end" className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </MotionRow>
                      );
                    })}
                  </motion.tbody>
                </Table>
                {visible.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserX className="size-5" />
                    </span>
                    <p className="font-medium">{t.contacts.list.emptyTitle}</p>
                    <p className="text-sm text-muted-foreground">{t.contacts.list.emptyBody}</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="justify-between border-t bg-muted/30 p-4 text-sm text-muted-foreground">
                <p aria-live="polite">
                  {filtered.length === 0 ? t.contacts.list.noResults : t.contacts.list.range(from, to, filtered.length)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? 'opacity-50' : ''}
                    onClick={() => currentPage > 1 && setPage(currentPage - 1)}
                  >
                    {t.common.previous}
                  </Button>
                  <span className="tabular-nums">
                    {currentPage} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-disabled={currentPage === pageCount}
                    className={currentPage === pageCount ? 'opacity-50' : ''}
                    onClick={() => currentPage < pageCount && setPage(currentPage + 1)}
                  >
                    {t.common.next}
                  </Button>
                </div>
              </CardFooter>
            </>
          )}
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
