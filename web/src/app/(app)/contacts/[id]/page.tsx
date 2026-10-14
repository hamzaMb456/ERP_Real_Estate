'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Copy, FileText, IdCard, Mail, MapPin, Pencil, Phone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT_ROLES, RoleBadge, type ContactRole } from '@/components/domain/badges';
import { HoverLift, Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { springs } from '@/lib/motion-tokens';
import { useGraphql } from '@/lib/use-graphql';

const CONTACT_QUERY = `
  query Contact($id: uuid!) {
    contact: contacts_by_pk(id: $id) {
      id
      kind
      full_name
      email
      phone
      national_id
      address
      notes
      roles { role }
    }
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
  roles: { role: ContactRole }[];
};

const EMPTY_TEXT: Record<ContactRole, string> = {
  owner: 'Aucune unité en gestion pour le moment.',
  renter: 'Aucun bail pour le moment.',
  buyer: 'Aucune offre ni réservation pour le moment.',
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
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label + ' copié');
  } catch {
    toast.error('Copie impossible', { description: 'Le navigateur a refusé l’accès au presse-papiers.' });
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
                  <Button variant="ghost" size="icon-xs" aria-label={'Copier ' + copyLabel} onClick={() => void copy(value, copyLabel)}>
                    <Copy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copier</TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Non renseigné</span>
        )}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/contacts">
        <ArrowLeft data-icon="inline-start" />
        Retour aux contacts
      </Link>
    </Button>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ contact: ContactDetails | null }>(CONTACT_QUERY, { id });

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">Chargement du contact…</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce contact : {result.message}
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
            <p className="font-medium">Contact introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou a été supprimée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const held = new Set(contact.roles.map((item) => item.role));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...springs.bouncy, delay: 0.1 }}
              >
                <Avatar className="size-16">
                  <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">
                    {initials(contact.full_name)}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{contact.full_name}</h1>
                  <p className="text-sm text-muted-foreground">{contact.kind === 'company' ? 'Société' : 'Personne'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contact.roles.map((item) => (
                    <RoleBadge key={item.role} role={item.role} />
                  ))}
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled>
                    <Pencil data-icon="inline-start" />
                    Modifier
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Téléphone" icon={Phone} value={contact.phone} href={contact.phone ? 'tel:' + contact.phone.replace(/\s/g, '') : undefined} copyLabel="le téléphone" />
              <InfoRow label="E-mail" icon={Mail} value={contact.email} href={contact.email ? 'mailto:' + contact.email : undefined} copyLabel="l’e-mail" />
              <InfoRow label={contact.kind === 'company' ? 'Matricule fiscal' : 'CIN (identité)'} icon={IdCard} value={contact.national_id} />
              <InfoRow label="Adresse" icon={MapPin} value={contact.address} />
            </dl>
          </CardContent>
        </Card>
      </StaggerItem>

      <Stagger className="grid gap-4 md:grid-cols-3">
        {CONTACT_ROLES.map((role) => {
          const Icon = role.icon;
          const active = held.has(role.value);
          return (
            <StaggerItem key={role.value} className="h-full">
              <HoverLift className="h-full">
                <Card className={'h-full ' + (active ? '' : 'bg-muted/40')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className={'flex size-7 items-center justify-center rounded-md ' + (active ? role.tile : 'bg-muted text-muted-foreground')}>
                        <Icon className="size-4" />
                      </span>
                      {role.label}
                    </CardTitle>
                    <CardDescription>{active ? 'Rôle actif' : 'Non applicable'}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {active ? EMPTY_TEXT[role.value] + ' L’historique apparaîtra ici avec les prochains modules.' : 'Ce contact n’a pas ce rôle.'}
                  </CardContent>
                </Card>
              </HoverLift>
            </StaggerItem>
          );
        })}
      </Stagger>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotesBody notes={contact.notes} />
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

function NotesBody({ notes }: { notes: string | null }): ReactNode {
  return notes ? (
    <p className="whitespace-pre-line text-sm leading-relaxed">{notes}</p>
  ) : (
    <p className="text-sm text-muted-foreground">Aucune note pour ce contact.</p>
  );
}
