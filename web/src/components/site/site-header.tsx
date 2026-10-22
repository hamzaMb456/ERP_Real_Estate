'use client';

import Link from 'next/link';
import { Building2, Menu, User, X } from '@/components/icons';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/utils';

// Slice 2 adds /compte/connexion; until then « Espace client » leads to the contact block.
const CLIENT_AREA_HREF = '/#contact';

const LINK_CLASS =
  'rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** Logo mark + name, linking to the home page. */
export function SiteLogo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link
      href="/"
      aria-label={t.site.homeLabel}
      className={cn(
        'inline-flex items-center gap-2 rounded-md font-heading-site text-lg font-bold tracking-tight text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
        <Building2 className="size-5" animation="none" />
      </span>
      {t.site.brand}
    </Link>
  );
}

/** Public site header: logo, main links, « Espace client », language switcher; a sheet menu below `md`. */
export function SiteHeader() {
  const { t, dir } = useI18n();
  const links = [
    { href: '/louer', label: t.site.nav.rent },
    { href: '/acheter', label: t.site.nav.buy },
    { href: '/#comment-ca-marche', label: t.site.nav.howItWorks },
    { href: '/#contact', label: t.site.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/75 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <SiteLogo />

        <nav aria-label={t.site.nav.label} className="ms-6 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher className="hidden md:inline-flex" contentClassName="site-root" />
          <Button
            asChild
            variant="outline"
            size="lg"
            className="hidden border-primary/20 bg-white/60 text-primary backdrop-blur hover:bg-white/90 md:inline-flex"
          >
            <Link href={CLIENT_AREA_HREF}>
              <User data-icon="inline-start" />
              {t.site.nav.clientArea}
            </Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-lg" className="md:hidden" aria-label={t.site.menu.open}>
                <Menu />
              </Button>
            </SheetTrigger>
            {/* The built-in close button has an English label: use our own, localised. */}
            <SheetContent side={dir === 'rtl' ? 'left' : 'right'} className="site-root" showCloseButton={false}>
              <SheetClose asChild>
                <Button variant="ghost" size="icon-sm" className="absolute top-3 end-3" aria-label={t.site.menu.close}>
                  <X />
                </Button>
              </SheetClose>
              <SheetHeader>
                <SheetTitle className="font-heading-site">{t.site.menu.title}</SheetTitle>
                <SheetDescription className="sr-only">{t.site.menu.description}</SheetDescription>
              </SheetHeader>
              <nav aria-label={t.site.nav.label} className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <Link href={link.href} className={cn(LINK_CLASS, 'py-3 text-base')}>
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3 p-4">
                <SheetClose asChild>
                  <Button asChild size="lg" className="h-10">
                    <Link href={CLIENT_AREA_HREF}>
                      <User data-icon="inline-start" />
                      {t.site.nav.clientArea}
                    </Link>
                  </Button>
                </SheetClose>
                <LanguageSwitcher variant="labeled" className="h-10 w-full justify-center" contentClassName="site-root" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
