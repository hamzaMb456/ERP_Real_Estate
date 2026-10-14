'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { RolePill } from '@/components/role-pill';
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
      created_at
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
  created_at: string;
  roles: { role: string }[];
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value || '—'}</dd>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ contact: ContactDetails | null }>(CONTACT_QUERY, { id });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/contacts" className="inline-flex w-fit items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden />
        Retour aux contacts
      </Link>

      {result.status === 'loading' && <p className="text-sm text-muted">Chargement du contact…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger ce contact : {result.message}
        </p>
      )}
      {result.status === 'success' && result.data.contact === null && (
        <p className="rounded-lg border border-line bg-white p-6 text-sm text-muted">Contact introuvable.</p>
      )}

      {result.status === 'success' && result.data.contact && (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{result.data.contact.full_name}</h1>
            <div className="flex flex-wrap gap-1.5">
              {result.data.contact.roles.map((item) => (
                <RolePill key={item.role} role={item.role} />
              ))}
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-line bg-white p-5 lg:col-span-2">
              <h2 className="mb-4 text-base font-semibold text-ink">Coordonnées</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" value={result.data.contact.kind === 'company' ? 'Société' : 'Personne'} />
                <Field
                  label={result.data.contact.kind === 'company' ? 'Matricule fiscal' : 'Pièce d’identité'}
                  value={result.data.contact.national_id}
                />
                <Field label="E-mail" value={result.data.contact.email} />
                <Field label="Téléphone" value={result.data.contact.phone} />
                <div className="sm:col-span-2">
                  <Field label="Adresse" value={result.data.contact.address} />
                </div>
              </dl>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-line bg-white p-5">
              <h2 className="text-base font-semibold text-ink">Actions rapides</h2>
              {result.data.contact.email && (
                <a className="inline-flex items-center gap-2 text-sm text-primary hover:underline" href={'mailto:' + result.data.contact.email}>
                  <Mail size={16} aria-hidden />
                  Écrire un e-mail
                </a>
              )}
              {result.data.contact.phone && (
                <a className="inline-flex items-center gap-2 text-sm text-primary hover:underline" href={'tel:' + result.data.contact.phone.replace(/\s/g, '')}>
                  <Phone size={16} aria-hidden />
                  Appeler
                </a>
              )}
              {result.data.contact.address && (
                <p className="inline-flex items-start gap-2 text-sm text-muted">
                  <MapPin size={16} aria-hidden className="mt-0.5 shrink-0" />
                  {result.data.contact.address}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-line bg-white p-5 lg:col-span-3">
              <h2 className="mb-2 text-base font-semibold text-ink">Notes</h2>
              <p className="whitespace-pre-line text-sm text-muted">{result.data.contact.notes || 'Aucune note.'}</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
