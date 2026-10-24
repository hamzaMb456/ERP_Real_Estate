import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountForm } from '@/components/site/account-form';
import { MESSAGES } from '@/i18n/messages';

export const metadata: Metadata = {
  title: MESSAGES.fr.site.account.signUpTitle,
  robots: { index: false, follow: true },
};

/** /compte/inscription: sign-up page of the clients. */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm mode="signup" />
    </Suspense>
  );
}
