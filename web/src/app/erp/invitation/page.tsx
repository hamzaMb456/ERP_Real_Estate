'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { ActivationFlow } from '@/components/staff/activation-flow';
import { useT } from '@/i18n/provider';

/** The page behind the emailed invitation link: /erp/invitation?token=... It sits outside the ERP shell, like the sign-in page. */
export default function InvitationPage() {
  return (
    <Suspense fallback={null}>
      <InvitationContent />
    </Suspense>
  );
}

function InvitationContent() {
  const token = useSearchParams().get('token') ?? '';
  const t = useT().shell.activation;
  return (
    <AuthSplitLayout>
      {token ? <ActivationFlow token={token} /> : <p role="alert" className="text-sm text-destructive">{t.invalid}</p>}
    </AuthSplitLayout>
  );
}
