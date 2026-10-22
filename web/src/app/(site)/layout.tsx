import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ScrollStagger } from '@/components/motion/primitives';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';
import { MESSAGES } from '@/i18n/messages';
import { siteConfig } from '@/lib/site/config';
import '../site.css';

// The public site is indexed in French only: the server always renders the French catalog.
export const metadata: Metadata = {
  title: { default: MESSAGES.fr.site.meta.title, template: '%s | Emerald Immobilier' },
  description: MESSAGES.fr.site.meta.description,
};

/** Public front office frame: header, `#contenu`, footer, always light (see app/site.css). No ERP shell here. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-root">
      {/* Reveals cards and [data-scroll-item] blocks on scroll, like the ERP shell. */}
      <ScrollStagger className="flex min-h-dvh flex-col">
        <SkipLink />
        <SiteHeader />
        <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter id="contact" phone={siteConfig.phone} email={siteConfig.email} address={siteConfig.address} />
      </ScrollStagger>
    </div>
  );
}
