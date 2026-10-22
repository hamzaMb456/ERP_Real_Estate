'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mail, MapPin, Phone, ShieldCheck } from '@/components/icons';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/i18n/provider';
import { SiteLogo } from './site-header';

type SiteFooterProps = {
  /** Anchor target of the « Contact » links. */
  id?: string;
  phone: string;
  email: string;
  address: string;
};

const LINK_CLASS =
  'rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const CONTACT_LINK_CLASS = 'rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-primary" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground [overflow-wrap:anywhere]">{children}</div>
      </div>
    </li>
  );
}

/** Public site footer: brand, trust badge, agency contact details, useful links, language and copyright. */
export function SiteFooter({ id, phone, email, address }: SiteFooterProps) {
  const { t } = useI18n();
  const tel = phone.replace(/[^\d+]/g, '');

  return (
    <footer id={id} className="border-t border-primary/10 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div className="flex flex-col items-start gap-4">
          <SiteLogo />
          <p className="max-w-xs text-sm text-muted-foreground">{t.site.footer.description}</p>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
            <ShieldCheck className="size-4 text-primary" animation="none" aria-hidden="true" />
            {t.site.footer.trustBadge}
          </p>
        </div>

        <div>
          <h2 className="font-heading-site mb-4 text-sm font-semibold text-foreground">{t.site.footer.contactTitle}</h2>
          <ul className="flex flex-col gap-4">
            <ContactRow icon={<MapPin className="size-4" animation="none" />} label={t.site.footer.address}>
              <address className="not-italic">{address}</address>
            </ContactRow>
            <ContactRow icon={<Phone className="size-4" animation="none" />} label={t.site.footer.phone}>
              <a href={`tel:${tel}`} dir="ltr" className={CONTACT_LINK_CLASS}>
                {phone}
              </a>
            </ContactRow>
            <ContactRow icon={<Mail className="size-4" animation="none" />} label={t.site.footer.email}>
              <a href={`mailto:${email}`} dir="ltr" className={CONTACT_LINK_CLASS}>
                {email}
              </a>
            </ContactRow>
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <nav aria-label={t.site.footer.linksTitle}>
            <h2 className="font-heading-site mb-4 text-sm font-semibold text-foreground">{t.site.footer.linksTitle}</h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/louer" className={LINK_CLASS}>
                  {t.site.nav.rent}
                </Link>
              </li>
              <li>
                <Link href="/acheter" className={LINK_CLASS}>
                  {t.site.nav.buy}
                </Link>
              </li>
              {/* The legal pages arrive in a later slice: shown as plain text until they exist. */}
              <li>
                <span className="text-sm text-muted-foreground">{t.site.footer.legalNotice}</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">{t.site.footer.privacy}</span>
              </li>
            </ul>
          </nav>
          <LanguageSwitcher variant="labeled" className="w-fit" contentClassName="site-root" />
        </div>
      </div>

      <div className="border-t border-primary/10">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          {t.site.footer.copyright}
        </p>
      </div>
    </footer>
  );
}
