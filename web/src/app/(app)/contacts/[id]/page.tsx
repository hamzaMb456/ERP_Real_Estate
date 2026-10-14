'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Contact as ContactIcon,
  FileText,
  Home,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { CONTACT_ROLES, type ContactRole } from '@/components/role-pill';
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

const ROLE_ICONS: Record<ContactRole, LucideIcon> = { owner: Home, renter: KeyRound, buyer: ShoppingCart };
const PILL_CLASSES: Record<ContactRole, string> = {
  owner: 'bg-emerald-50 text-brand border-emerald-200',
  renter: 'bg-slate-100 text-slate-700 border-slate-200',
  buyer: 'bg-amber-50 text-amber-800 border-amber-200',
};
const EMPTY_TEXT: Record<ContactRole, string> = {
  owner: 'Aucune unité en gestion',
  renter: 'Aucun bail',
  buyer: 'Aucune offre ni réservation',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function InfoRow({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        {children}
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ contact: ContactDetails | null }>(CONTACT_QUERY, { id });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand-dark"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>Retour aux contacts</span>
        </Link>
      </div>

      {result.status === 'loading' && <p className="text-xs text-slate-500">Chargement du contact…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-800">
          Impossible de charger ce contact : {result.message}
        </p>
      )}
      {result.status === 'success' && result.data.contact === null && (
        <p className="rounded-lg border border-app-border bg-white p-6 text-xs text-slate-500">Contact introuvable.</p>
      )}
      {result.status === 'success' && result.data.contact && <ContactView contact={result.data.contact} />}
    </div>
  );
}

function ContactView({ contact }: { contact: ContactDetails }) {
  const held = new Set(contact.roles.map((item) => item.role));

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-app-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-[#E6F4EA] text-xl font-bold text-brand">
            {initials(contact.full_name)}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight text-slate-900">{contact.full_name}</h1>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {contact.kind === 'company' ? 'Société' : 'Personne'}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              {CONTACT_ROLES.filter((role) => held.has(role.value)).map((role) => {
                const Icon = ROLE_ICONS[role.value];
                return (
                  <span
                    key={role.value}
                    className={
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ' +
                      PILL_CLASSES[role.value]
                    }
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {role.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white opacity-60 shadow-sm"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          <span>Modifier</span>
        </button>
      </div>

      <div className="rounded-lg border border-app-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
          <ContactIcon className="h-4 w-4 text-brand" aria-hidden />
          <h2 className="text-base font-bold text-slate-900">Coordonnées</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <InfoRow label="Téléphone" icon={Phone}>
            <span>{contact.phone ?? '—'}</span>
          </InfoRow>
          <InfoRow label="E-mail" icon={Mail}>
            {contact.email ? (
              <a href={'mailto:' + contact.email} className="truncate text-brand hover:underline">
                {contact.email}
              </a>
            ) : (
              <span>—</span>
            )}
          </InfoRow>
          <InfoRow label={contact.kind === 'company' ? 'Matricule fiscal' : 'CIN (Identité)'} icon={IdCard}>
            <span>{contact.national_id ?? '—'}</span>
          </InfoRow>
          <InfoRow label="Adresse" icon={MapPin}>
            <span className="truncate">{contact.address ?? '—'}</span>
          </InfoRow>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {CONTACT_ROLES.map((role) => {
          const Icon = ROLE_ICONS[role.value];
          const active = held.has(role.value);
          return (
            <div
              key={role.value}
              className="flex flex-col justify-between rounded-lg border border-app-border bg-white p-5 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={
                        'flex h-7 w-7 items-center justify-center rounded-md ' +
                        (active ? role.tile : 'bg-slate-50 text-slate-400')
                      }
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{role.label}</h3>
                  </div>
                  <span
                    className={'h-2 w-2 rounded-full ' + (active ? 'bg-emerald-500' : 'bg-slate-300')}
                    title={active ? 'Actif' : 'Inactif'}
                  />
                </div>
                {active ? (
                  <div className="text-xs leading-relaxed text-slate-600">
                    <p className="font-medium text-slate-800">Rôle actif</p>
                    <p className="mt-0.5 text-slate-500">Les baux, unités et offres liés seront affichés ici.</p>
                  </div>
                ) : (
                  <div className="text-xs italic leading-relaxed text-slate-400">
                    <p>{EMPTY_TEXT[role.value]}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-4">
                {active ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <span>Détails bientôt disponibles</span>
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Aucun historique</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-app-border bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileText className="h-4 w-4 text-slate-400" aria-hidden />
          <h2 className="text-sm font-bold text-slate-900">Notes</h2>
        </div>
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">{contact.notes || 'Aucune note.'}</p>
      </div>
    </>
  );
}
