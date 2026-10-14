'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ContactForm } from '@/components/domain/contact-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/contacts">
          <ArrowLeft data-icon="inline-start" />
          Retour aux contacts
        </Link>
      </Button>
      <PageHeader
        title="Ajouter un contact"
        description="Créez la fiche d’un propriétaire, locataire ou acquéreur. Un contact peut cumuler plusieurs rôles."
      />
      <ContactForm mode="create" />
    </div>
  );
}
