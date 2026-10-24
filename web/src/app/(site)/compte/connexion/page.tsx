import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountForm } from '@/components/site/account-form';
import { MESSAGES } from '@/i18n/messages';

export const metadata: Metadata = {
  title: MESSAGES.fr.site.account.signInTitle,
  robots: { index: false, follow: true },
};

/** /compte/connexion: sign-in page of the clients (useSearchParams needs the Suspense boundary). */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm mode="signin" />
    </Suspense>
  );
}
