'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Building2, Save, User } from 'lucide-react';
import { pressable } from '@/components/motion/primitives';
import { CONTACT_ROLES, RolePill, type ContactRole } from '@/components/role-pill';
import { springs } from '@/lib/motion-tokens';
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

const FIELD =
  'w-full h-11 px-3.5 text-sm bg-white border border-app-border rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all';
const LABEL = 'block text-xs font-semibold text-slate-700 mb-1.5';

const ROLE_SELECTED: Record<ContactRole, string> = {
  owner: 'border-2 border-emerald-400 bg-emerald-50/40 shadow-sm',
  renter: 'border-2 border-slate-400 bg-slate-50 shadow-sm',
  buyer: 'border-2 border-amber-400 bg-[#FFFBEB]/40 shadow-sm',
};

function textOrNull(data: FormData, key: string): string | null {
  const value = String(data.get(key) ?? '').trim();
  return value === '' ? null : value;
}

export default function NewContactPage() {
  const router = useRouter();
  const [kind, setKind] = useState<'person' | 'company'>('person');
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
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
    const phone = textOrNull(data, 'telephone');
    setSubmitting(true);
    try {
      let contactId = createdId;
      if (contactId === null) {
        const created = await graphql<{ insert_contacts_one: { id: string } }>(ADD_CONTACT, {
          object: {
            kind,
            full_name: String(data.get('nom_complet')).trim(),
            email: textOrNull(data, 'email'),
            phone: phone === null ? null : '+216 ' + phone,
            national_id: textOrNull(data, 'identifiant_fiscal'),
            address: textOrNull(data, 'adresse'),
          },
        });
        contactId = created.insert_contacts_one.id;
        setCreatedId(contactId);
      }
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href="/contacts"
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition-colors hover:text-brand-dark"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Retour aux contacts
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ajouter un contact</h1>
        <p className="mt-1 text-xs text-slate-500">
          Créez la fiche d’un propriétaire, locataire ou acquéreur dans votre base opérationnelle.
        </p>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-700">Type de contact</span>
            <div
              role="radiogroup"
              aria-label="Type de contact"
              className="grid max-w-sm grid-cols-2 gap-3 rounded-lg border border-app-border bg-slate-50 p-1"
            >
              {(
                [
                  { value: 'person', label: 'Personne', icon: User },
                  { value: 'company', label: 'Société', icon: Building2 },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                const selected = kind === option.value;
                return (
                  <motion.label
                    key={option.value}
                    className={
                      'relative flex cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ' +
                      (selected ? 'font-semibold text-brand' : 'font-medium text-slate-600 hover:text-slate-900')
                    }
                    whileTap={{ scale: 0.96 }}
                    transition={springs.snappy}
                  >
                    {selected && (
                      <motion.span
                        layoutId="contact-kind"
                        className="absolute inset-0 rounded-md border border-emerald-200 bg-white shadow-sm"
                        transition={springs.snappy}
                      />
                    )}
                    <input
                      type="radio"
                      name="contact_type"
                      value={option.value}
                      checked={selected}
                      onChange={() => setKind(option.value)}
                      className="sr-only"
                    />
                    <Icon className="relative z-10 h-3.5 w-3.5" aria-hidden />
                    <span className="relative z-10">{option.label}</span>
                  </motion.label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="nom_complet" className={LABEL}>
              Nom complet <span className="text-rose-500">*</span>
            </label>
            <input id="nom_complet" name="nom_complet" type="text" required placeholder="Ex. Salma Gharbi" className={FIELD} />
          </div>

          <div>
            <label htmlFor="telephone" className={LABEL}>
              Téléphone
            </label>
            <div className="relative flex rounded-lg">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-app-border bg-slate-50 px-3.5 text-xs font-medium text-slate-600">
                +216
              </span>
              <input
                id="telephone"
                name="telephone"
                type="tel"
                placeholder="98 123 456"
                className={FIELD.replace('rounded-lg', 'rounded-r-lg')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={LABEL}>
              E-mail
            </label>
            <input id="email" name="email" type="email" placeholder="salma.gharbi@email.tn" className={FIELD} />
          </div>

          <div>
            <label htmlFor="identifiant_fiscal" className={LABEL}>
              CIN ou matricule fiscal
            </label>
            <input
              id="identifiant_fiscal"
              name="identifiant_fiscal"
              type="text"
              placeholder="Ex. 08942155 ou 1489201/A"
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="adresse" className={LABEL}>
              Adresse
            </label>
            <input id="adresse" name="adresse" type="text" placeholder="Ex. 14 Rue des Jardins, Carthage, Tunis" className={FIELD} />
          </div>

          <div className="border-t border-app-border pt-5">
            <div className="mb-3">
              <span className="block text-xs font-semibold text-slate-800">Rôle(s)</span>
              <p className="mt-0.5 text-xs text-slate-500">Un contact peut avoir plusieurs rôles.</p>
            </div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {CONTACT_ROLES.map((role) => {
                const selected = roles.includes(role.value);
                return (
                  <motion.label
                    key={role.value}
                    className={
                      'relative flex cursor-pointer select-none flex-col rounded-lg p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ' +
                      (selected ? ROLE_SELECTED[role.value] : 'border border-app-border bg-white hover:border-slate-400')
                    }
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    animate={{ scale: selected ? 1.02 : 1 }}
                    transition={springs.snappy}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <RolePill role={role.value} />
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRole(role.value)}
                        className="h-4 w-4 rounded border-slate-300 accent-brand"
                      />
                    </div>
                    <span className="mt-1 text-xs leading-relaxed text-slate-500">{role.description}</span>
                  </motion.label>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"
                initial={{ opacity: 0, x: 0 }}
                animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-3 border-t border-app-border pt-6">
            <Link href="/contacts" className="px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900">
              Annuler
            </Link>
            <motion.button
              type="submit"
              disabled={submitting}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
              {...pressable}
            >
              <motion.span
                animate={submitting ? { rotate: 360 } : { rotate: 0 }}
                transition={submitting ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                className="inline-flex"
              >
                <Save className="h-4 w-4" aria-hidden />
              </motion.span>
              {submitting ? 'Enregistrement…' : 'Enregistrer le contact'}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}
