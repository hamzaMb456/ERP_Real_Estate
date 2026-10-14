'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CONTACT_ROLES, type ContactRole } from '@/components/role-pill';
import { graphql } from '@/lib/graphql';

const ADD_CONTACT = `
  mutation AddContact($object: contacts_insert_input!) {
    insert_contacts_one(object: $object) { id }
  }
`;

const ADD_ROLES = `
  mutation AddContactRoles($objects: [contact_roles_insert_input!]!) {
    insert_contact_roles(objects: $objects) { affected_rows }
  }
`;

const inputClass =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function textOrNull(data: FormData, key: string): string | null {
  const value = String(data.get(key) ?? '').trim();
  return value === '' ? null : value;
}

export default function NewContactPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleRole(role: ContactRole) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (roles.length === 0) {
      setError('Choisissez au moins un rôle : propriétaire, locataire ou acquéreur.');
      return;
    }
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const created = await graphql<{ insert_contacts_one: { id: string } }>(ADD_CONTACT, {
        object: {
          kind: String(data.get('kind')),
          full_name: String(data.get('full_name')).trim(),
          email: textOrNull(data, 'email'),
          phone: textOrNull(data, 'phone'),
          national_id: textOrNull(data, 'national_id'),
          address: textOrNull(data, 'address'),
          notes: textOrNull(data, 'notes'),
        },
      });
      const contactId = created.insert_contacts_one.id;
      try {
        await graphql(ADD_ROLES, { objects: roles.map((role) => ({ contact_id: contactId, role })) });
      } catch (rolesError) {
        const reason = rolesError instanceof Error ? rolesError.message : 'erreur inconnue';
        setError('Le contact a été créé mais ses rôles n’ont pas pu être enregistrés : ' + reason);
        return;
      }
      router.push('/contacts/' + contactId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/contacts" className="inline-flex w-fit items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden />
        Retour aux contacts
      </Link>
      <h1 className="text-2xl font-semibold text-ink">Ajouter un contact</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-lg border border-line bg-white p-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Rôles</legend>
          <div className="flex flex-wrap gap-2">
            {CONTACT_ROLES.map((option) => (
              <label
                key={option.value}
                className={
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ' +
                  (roles.includes(option.value) ? 'border-primary bg-soft text-primary' : 'border-line text-muted')
                }
              >
                <input
                  type="checkbox"
                  checked={roles.includes(option.value)}
                  onChange={() => toggleRole(option.value)}
                  className="accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Type
            <select name="kind" defaultValue="person" className={inputClass}>
              <option value="person">Personne</option>
              <option value="company">Société</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Nom complet
            <input name="full_name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            E-mail
            <input name="email" type="email" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Téléphone
            <input name="phone" type="tel" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink sm:col-span-2">
            Pièce d’identité ou matricule fiscal
            <input name="national_id" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink sm:col-span-2">
            Adresse
            <input name="address" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink sm:col-span-2">
            Notes
            <textarea name="notes" rows={3} className={inputClass + ' h-auto py-2'} />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le contact'}
          </button>
          <Link href="/contacts" className="inline-flex h-10 items-center rounded-lg border border-line px-5 text-sm text-muted hover:text-ink">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
