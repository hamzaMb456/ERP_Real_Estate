'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { CONTACT_ROLES, RolePill, type ContactRole } from '@/components/role-pill';
import { useGraphql } from '@/lib/use-graphql';

const CONTACTS_QUERY = `
  query Contacts {
    contacts(order_by: { full_name: asc }) {
      id
      kind
      full_name
      email
      phone
      roles { role }
    }
  }
`;

type Contact = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  roles: { role: ContactRole }[];
};

export default function ContactsPage() {
  const result = useGraphql<{ contacts: Contact[] }>(CONTACTS_QUERY);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContactRole | 'all'>('all');

  const needle = search.trim().toLowerCase();
  const contacts =
    result.status === 'success'
      ? result.data.contacts.filter(
          (contact) =>
            (roleFilter === 'all' || contact.roles.some((item) => item.role === roleFilter)) &&
            (needle === '' ||
              contact.full_name.toLowerCase().includes(needle) ||
              (contact.email ?? '').toLowerCase().includes(needle) ||
              (contact.phone ?? '').includes(needle)),
        )
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Contacts</h1>
        <Link
          href="/contacts/nouveau"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus size={16} aria-hidden />
          Ajouter un contact
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Rechercher un contact</span>
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, e-mail ou téléphone"
            className="h-10 w-72 rounded-lg border border-line bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div role="group" aria-label="Filtrer par rôle" className="flex flex-wrap gap-2">
          {[{ value: 'all' as const, label: 'Tous' }, ...CONTACT_ROLES].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={roleFilter === option.value}
              onClick={() => setRoleFilter(option.value)}
              className={
                'h-10 rounded-lg border px-3 text-sm ' +
                (roleFilter === option.value
                  ? 'border-primary bg-soft font-medium text-primary'
                  : 'border-line bg-white text-muted hover:text-ink')
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {result.status === 'loading' && <p className="text-sm text-muted">Chargement des contacts…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les contacts : {result.message}
        </p>
      )}

      {result.status === 'success' && (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-page text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Nom</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">E-mail</th>
                <th className="px-5 py-2.5 font-medium">Téléphone</th>
                <th className="px-5 py-2.5 font-medium">Rôles</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-line hover:bg-page">
                  <td className="px-5 py-3 font-medium text-ink">
                    <Link href={'/contacts/' + contact.id} className="hover:text-primary hover:underline">
                      {contact.full_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{contact.kind === 'company' ? 'Société' : 'Personne'}</td>
                  <td className="px-5 py-3">{contact.email ?? '—'}</td>
                  <td className="px-5 py-3 tabular-nums">{contact.phone ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {contact.roles.map((item) => (
                        <RolePill key={item.role} role={item.role} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Aucun contact ne correspond à votre recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
