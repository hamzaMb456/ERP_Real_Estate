'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Home, KeyRound, Plus, Search, ShoppingCart, type LucideIcon } from 'lucide-react';
import { CONTACT_ROLES, RolePill, type ContactRole } from '@/components/role-pill';
import { useGraphql } from '@/lib/use-graphql';

const CONTACTS_QUERY = `
  query Contacts {
    contacts(order_by: { full_name: asc }) {
      id
      kind
      full_name
      phone
      roles { role }
    }
  }
`;

type Contact = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  phone: string | null;
  roles: { role: ContactRole }[];
};

const ROLE_ICONS: Record<ContactRole, LucideIcon> = { owner: Home, renter: KeyRound, buyer: ShoppingCart };
const PAGE_SIZE = 10;

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
  const result = useGraphql<{ contacts: Contact[] }>(CONTACTS_QUERY);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContactRole | 'all'>('all');
  const [page, setPage] = useState(1);

  const all = result.status === 'success' ? result.data.contacts : [];
  const countFor = (role: ContactRole) => all.filter((contact) => contact.roles.some((item) => item.role === role)).length;
  const needle = search.trim().toLowerCase();
  const filtered = all.filter(
    (contact) =>
      (roleFilter === 'all' || contact.roles.some((item) => item.role === roleFilter)) &&
      (needle === '' || contact.full_name.toLowerCase().includes(needle) || (contact.phone ?? '').includes(needle)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const tabs: { value: ContactRole | 'all'; label: string }[] = [
    { value: 'all', label: 'Tous (' + all.length + ')' },
    { value: 'owner', label: 'Propriétaires (' + countFor('owner') + ')' },
    { value: 'renter', label: 'Locataires (' + countFor('renter') + ')' },
    { value: 'buyer', label: 'Acquéreurs (' + countFor('buyer') + ')' },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Contacts</h2>
          <p className="mt-1 text-xs text-slate-500">
            Les personnes et sociétés avec qui vous travaillez : propriétaires, locataires et acquéreurs.
          </p>
        </div>
        <Link
          href="/contacts/nouveau"
          className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span>Ajouter un contact</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CONTACT_ROLES.map((role) => {
          const Icon = ROLE_ICONS[role.value];
          return (
            <div key={role.value} className="flex items-start gap-3.5 rounded-lg border border-app-border bg-white p-4 shadow-sm">
              <div className={'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + role.tile}>
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <RolePill role={role.value} />
                </div>
                <p className="text-xs leading-relaxed text-slate-500">{role.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-app-border bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-app-border p-4 md:flex-row md:items-center">
          <div role="group" aria-label="Filtrer par rôle" className="flex flex-wrap items-center gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={roleFilter === tab.value}
                onClick={() => {
                  setRoleFilter(tab.value);
                  setPage(1);
                }}
                className={
                  'rounded-lg px-3 py-1.5 text-xs transition-colors ' +
                  (roleFilter === tab.value
                    ? 'bg-brand font-semibold text-white'
                    : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="relative w-full md:w-72">
            <span className="sr-only">Rechercher un contact</span>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-3.5 w-3.5" aria-hidden />
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un nom, un téléphone…"
              className="w-full rounded-lg border border-app-border bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 transition-colors focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </label>
        </div>

        {result.status === 'loading' && <p className="p-6 text-xs text-slate-500">Chargement des contacts…</p>}
        {result.status === 'error' && (
          <p role="alert" className="m-4 rounded-lg bg-red-50 px-4 py-3 text-xs text-red-800">
            Impossible de charger les contacts : {result.message}
          </p>
        )}

        {result.status === 'success' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-app-border bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Rôle(s)</th>
                    <th className="px-4 py-3">Téléphone</th>
                    <th className="px-4 py-3">Biens / unités</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((contact) => {
                    const primary = CONTACT_ROLES.find((role) => contact.roles.some((item) => item.role === role.value));
                    return (
                      <tr key={contact.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                                (primary?.avatar ?? 'bg-slate-100 text-slate-700')
                              }
                            >
                              {initials(contact.full_name)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{contact.full_name}</div>
                              <div className="text-[11px] font-normal text-slate-500">
                                {contact.kind === 'company' ? 'Société' : 'Personne'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {contact.roles.map((item) => (
                              <RolePill key={item.role} role={item.role} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{contact.phone ?? '—'}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">—</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={'/contacts/' + contact.id}
                            className="inline-flex items-center gap-1 font-semibold text-brand hover:text-emerald-900 hover:underline"
                          >
                            <span>Voir</span>
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Aucun contact ne correspond à votre recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-app-border bg-slate-50/50 p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Affichage{' '}
                <span className="font-semibold text-slate-800">
                  {from} à {to}
                </span>{' '}
                sur <span className="font-semibold text-slate-800">{filtered.length}</span> contacts
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Précédent
                </button>
                <span className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white">{currentPage}</span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
