'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ContactRole } from '@/components/domain/badges';
import { ContactForm, phoneForForm, type ContactFormValues } from '@/components/domain/contact-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useGraphql } from '@/lib/use-graphql';

const CONTACT_QUERY = `
  query ContactForEdit($id: uuid!) {
    contact: contacts_by_pk(id: $id) {
      id kind full_name email phone national_id address notes
      roles { role }
      current_ownerships_aggregate { aggregate { count } }
    }
  }
`;

type ContactRow = {
  id: string;
  kind: 'person' | 'company';
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  roles: { role: ContactRole }[];
  current_ownerships_aggregate: { aggregate: { count: number } | null };
};

function toFormValues(row: ContactRow): ContactFormValues {
  return {
    kind: row.kind,
    full_name: row.full_name,
    phone: phoneForForm(row.phone),
    email: row.email ?? '',
    national_id: row.national_id ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    roles: row.roles.map((item) => item.role),
  };
}

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ contact: ContactRow | null }>(CONTACT_QUERY, { id });
  const contact = result.status === 'success' ? result.data.contact : null;
  const ownsUnits = (contact?.current_ownerships_aggregate.aggregate?.count ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={'/contacts/' + id}>
          <ArrowLeft data-icon="inline-start" />
          Retour au contact
        </Link>
      </Button>
      {result.status === 'loading' && <Pulse className="text-sm text-muted-foreground">Chargement du contact…</Pulse>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger ce contact : {result.message}
        </p>
      )}
      {result.status === 'success' && !contact && (
        <p className="text-sm text-muted-foreground">Ce contact n’existe pas ou vous n’y avez pas accès.</p>
      )}
      {contact && (
        <>
          <PageHeader title={'Modifier ' + contact.full_name} description="Corrigez les coordonnées et les rôles du contact." />
          <ContactForm
            mode="edit"
            contactId={id}
            initial={toFormValues(contact)}
            lockedRoles={ownsUnits ? ['owner'] : []}
          />
        </>
      )}
    </div>
  );
}
