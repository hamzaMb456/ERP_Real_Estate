'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, ArrowLeft, Copy, FileText, IdCard, Loader2, Mail, MapPin, Pencil, Phone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT_ROLES, RoleBadge, type ContactRole } from '@/components/domain/badges';
import { HoverLift, Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { ContactGuaranteedLeases, ContactRenterLeases } from '@/components/leases/contact-leases';
import { ContactOwnedUnits } from '@/components/ownership/contact-owned-units';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { springs } from '@/lib/motion-tokens';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { getMessages } from '@/i18n/store';
import { useT } from '@/i18n/provider';
const CONTACT_QUERY = `
  query Contact($id: uuid!) {
    contact: contacts_by_pk(id: $id) {
      id kind full_name email phone national_id address notes is_organization archived_at
      roles { role }
    }
  }
`;

const SET_ARCHIVED = `
  mutation SetContactArchived($id: uuid!, $archived_at: timestamptz) {
    update_contacts_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

type ContactDetails = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  is_organization: boolean;
  archived_at: string | null;
  roles: { role: ContactRole }[];
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

async function copy(value: string, label: string) {
  const t = getMessages().contacts.detail;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(t.copied(label));
  } catch {
    toast.error(t.copyFailed, { description: t.clipboardDenied });
  }
}

function InfoRow({
  label,
  icon: Icon,
  value,
  href,
  copyLabel,
}: {
  label: string;
  icon: typeof Mail;
  value: string | null;
  href?: string;
  copyLabel?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {value ? (
          <>
            {href ? (
              <a href={href} className="truncate font-medium text-primary hover:underline">
                {value}
              </a>
            ) : (
              <span className="truncate font-medium">{value}</span>
            )}
            {copyLabel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label={t.contacts.detail.copyAria(copyLabel)} onClick={() => void copy(value, copyLabel)}>
                    <Copy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.contacts.detail.copy}</TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">{t.contacts.detail.notProvided}</span>
        )}
      </dd>
    </div>
  );
}

function BackLink() {
  const t = useT();
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href="/contacts">
        <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
        {t.contacts.backToList}
      </Link>
    </Button>
  );
}

export default function ContactDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const result = useGraphql<{ contact: ContactDetails | null }>(CONTACT_QUERY, { id }, reload);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">{t.contacts.detail.loading}</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.contacts.detail.loadError(result.message)}
        </p>
      </div>
    );
  }

  const contact = result.data.contact;
  if (!contact) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserX className="size-5" />
            </span>
            <p className="font-medium">{t.contacts.detail.notFoundTitle}</p>
            <p className="text-sm text-muted-foreground">{t.contacts.detail.notFoundBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = contact;
  const archived = current.archived_at !== null;
  const held = new Set(current.roles.map((item) => item.role));

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: current.id, archived_at: archived ? null : new Date().toISOString() });
      toast.success(archived ? t.contacts.detail.restoredToast : t.contacts.detail.archivedToast, { description: current.full_name });
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(t.contacts.detail.actionFailed, { description: toUserMessage(error) });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...springs.bouncy, delay: 0.1 }}>
                <Avatar className="size-16">
                  <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">{initials(current.full_name)}</AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{current.full_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {t.contacts.kinds[current.kind]}
                    {current.is_organization && t.contacts.orgSuffix}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {current.roles.map((item) => (
                    <RoleBadge key={item.role} role={item.role} />
                  ))}
                  {archived && <Badge variant="secondary">{t.contacts.archivedBadge}</Badge>}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={'/contacts/' + current.id + '/modifier'}>
                    <Pencil data-icon="inline-start" />
                    {t.common.edit}
                  </Link>
                </Button>
                {!current.is_organization && (
                  <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
                    {archiving ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {archived ? t.contacts.detail.restore : t.contacts.detail.archive}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>{t.contacts.detail.coordinates}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label={t.contacts.detail.phone} icon={Phone} value={current.phone} href={current.phone ? 'tel:' + current.phone.replace(/\s/g, '') : undefined} copyLabel={t.contacts.detail.copyPhone} />
              <InfoRow label={t.contacts.detail.email} icon={Mail} value={current.email} href={current.email ? 'mailto:' + current.email : undefined} copyLabel={t.contacts.detail.copyEmail} />
              <InfoRow label={current.kind === 'company' ? t.contacts.detail.taxId : t.contacts.detail.nationalId} icon={IdCard} value={current.national_id} />
              <InfoRow label={t.contacts.detail.address} icon={MapPin} value={current.address} />
            </dl>
          </CardContent>
        </Card>
      </StaggerItem>

      <Stagger className="grid gap-4 lg:grid-cols-3">
        {CONTACT_ROLES.map((role) => {
          const Icon = role.icon;
          const active = held.has(role.value);
          return (
            <StaggerItem key={role.value} className={role.value === 'owner' ? 'h-full lg:col-span-3' : 'h-full'}>
              <HoverLift className="h-full">
                <Card className={'h-full ' + (active ? '' : 'bg-muted/40')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className={'flex size-7 items-center justify-center rounded-md ' + (active ? role.tile : 'bg-muted text-muted-foreground')}>
                        <Icon className="size-4" />
                      </span>
                      {t.labels.contactRoles[role.value].label}
                    </CardTitle>
                    <CardDescription>{active ? t.contacts.detail.roleActive : t.contacts.detail.roleInactive}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {!active && t.contacts.detail.noRole}
                    {active && role.value === 'owner' && <ContactOwnedUnits contactId={current.id} />}
                    {active && role.value === 'renter' && <ContactRenterLeases contactId={current.id} />}
                    {active && role.value === 'buyer' && t.contacts.detail.buyerLater}
                  </CardContent>
                </Card>
              </HoverLift>
            </StaggerItem>
          );
        })}
      </Stagger>

      <StaggerItem>
        <ContactGuaranteedLeases contactId={current.id} />
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-muted-foreground" />
              {t.contacts.detail.notes}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {current.notes ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{current.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t.contacts.detail.noNotes}</p>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}
