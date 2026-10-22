'use client';

import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { ContactForm } from '@/components/domain/contact-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

import { useT } from '@/i18n/provider';
export default function NewContactPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/contacts">
          <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
          {t.contacts.backToList}
        </Link>
      </Button>
      <PageHeader
        title={t.contacts.new.title}
        description={t.contacts.new.description}
      />
      <ContactForm mode="create" />
    </div>
  );
}
