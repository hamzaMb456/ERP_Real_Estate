import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { MESSAGES } from '@/i18n/messages';
import { SIGN_IN_PATH } from '@/lib/site/account';

export const metadata: Metadata = {
  title: MESSAGES.fr.shell.resetPassword.requestTitle,
  robots: { index: false, follow: true },
};

/** /compte/mot-de-passe-oublie: forgotten password of the clients of the public site. */
export default function SiteForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-primary/15 bg-card p-6 shadow-lg sm:p-8">
        <ResetPasswordForm variant="site" signInPath={SIGN_IN_PATH} />
      </div>
    </div>
  );
}
