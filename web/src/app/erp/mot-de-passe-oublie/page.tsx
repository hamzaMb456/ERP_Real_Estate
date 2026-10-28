import type { Metadata } from 'next';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { MESSAGES } from '@/i18n/messages';
import { erpPath } from '@/lib/erp-paths';

export const metadata: Metadata = {
  title: MESSAGES.fr.shell.resetPassword.requestTitle,
  robots: { index: false, follow: false },
};

/** /erp/mot-de-passe-oublie: forgotten password of the ERP staff. */
export default function ErpForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <ResetPasswordForm variant="erp" signInPath={erpPath('/connexion')} />
    </AuthSplitLayout>
  );
}
