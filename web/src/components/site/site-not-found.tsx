'use client';

import Link from 'next/link';
import { SearchX } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';

/** Friendly 404 of the public site (rendered inside the (site) layout). */
export function SiteNotFound() {
  const t = useT();
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary" aria-hidden="true">
        <SearchX className="size-7" animation="none" />
      </span>
      <h1 className="font-heading-site text-3xl font-bold tracking-tight text-foreground">{t.site.notFound.title}</h1>
      <p className="text-muted-foreground">{t.site.notFound.description}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="h-10 px-4">
          <Link href="/louer">{t.site.notFound.cta}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-10 px-4">
          <Link href="/">{t.site.notFound.home}</Link>
        </Button>
      </div>
    </section>
  );
}
