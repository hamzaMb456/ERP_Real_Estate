'use client';

import Link from 'next/link';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import type { NavKey } from '@/lib/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PlaceholderCard({ labelKey }: { labelKey: NavKey }) {
  const t = useT();
  const label = t.nav.items[labelKey];
  return (
    <div className="space-y-6">
      <PageHeader title={label} description={t.shell.placeholder.description} />
      <Card className="border-dashed bg-muted/40">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Construction className="size-5" />
          </span>
          <CardTitle>{t.shell.placeholder.title}</CardTitle>
          <CardDescription className="max-w-md">
            {t.shell.placeholder.body(label)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/biens">{t.shell.placeholder.seeProperties}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacts">{t.shell.placeholder.seeContacts}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
