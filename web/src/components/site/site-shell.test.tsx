import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import { MESSAGES } from '@/i18n/messages';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

const contact = { phone: '+216 71 000 000', email: 'contact@emerald-immobilier.tn', address: 'Tunis' };

afterEach(() => setLocale('fr'));

describe('SiteHeader', () => {
  it('links to the rent and buy searches and keeps the anchors on the home page', () => {
    render(<SiteHeader />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Louer' })).toHaveAttribute('href', '/louer');
    expect(within(nav).getByRole('link', { name: 'Acheter' })).toHaveAttribute('href', '/acheter');
    expect(within(nav).getByRole('link', { name: 'Comment ça marche' })).toHaveAttribute('href', '/#comment-ca-marche');
    expect(within(nav).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/#contact');
    expect(screen.getByRole('link', { name: /Emerald Immobilier/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Espace client' })).toHaveAttribute('href', '/#contact');
  });

  it('shows the Arabic labels with the ar catalog', () => {
    setLocale('ar');
    render(
      <I18nProvider>
        <SiteHeader />
      </I18nProvider>,
    );
    const nav = screen.getByRole('navigation', { name: MESSAGES.ar.site.nav.label });
    expect(within(nav).getByRole('link', { name: MESSAGES.ar.site.nav.rent })).toHaveAttribute('href', '/louer');
    expect(within(nav).getByRole('link', { name: MESSAGES.ar.site.nav.buy })).toHaveAttribute('href', '/acheter');
    expect(MESSAGES.ar.site.nav.rent).not.toBe('Louer');
  });
});

describe('SiteHeader mobile menu', () => {
  it('names the close button with the French catalog string', () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByRole('button', { name: MESSAGES.fr.site.menu.open }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: MESSAGES.fr.site.menu.close });
    expect(close).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
  });

  it('names the close button with the Arabic catalog string, never "Close"', () => {
    setLocale('ar');
    render(
      <I18nProvider>
        <SiteHeader />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: MESSAGES.ar.site.menu.open }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: MESSAGES.ar.site.menu.close })).toBeInTheDocument();
    expect(within(dialog).queryByText(/close/i)).not.toBeInTheDocument();
  });
});

describe('SiteFooter', () => {
  it('shows the trust badge, the agency contact details and the copyright', () => {
    render(<SiteFooter id="contact" {...contact} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('id', 'contact');
    expect(within(footer).getByText('Agence immobilière agréée — Tunisie')).toBeInTheDocument();
    expect(within(footer).getByText('© 2026 Emerald Immobilier Tunisie. Tous droits réservés.')).toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: contact.email })).toHaveAttribute('href', `mailto:${contact.email}`);
    expect(within(footer).getByRole('link', { name: contact.phone })).toHaveAttribute('href', 'tel:+21671000000');
    expect(within(footer).getByRole('link', { name: 'Louer' })).toHaveAttribute('href', '/louer');
    expect(within(footer).getByRole('link', { name: 'Acheter' })).toHaveAttribute('href', '/acheter');
  });

  it('never mentions a French professional body', () => {
    render(
      <>
        <SiteHeader />
        <SiteFooter id="contact" {...contact} />
      </>,
    );
    expect(document.body.textContent).not.toMatch(/FNAIM/i);
    for (const locale of ['fr', 'en', 'ar'] as const) {
      expect(JSON.stringify(MESSAGES[locale].site)).not.toMatch(/FNAIM/i);
    }
  });
});
