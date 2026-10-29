'use client';

import { usePathname, useRouter } from 'next/navigation';
import { EyeOff } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { useClientSession } from '@/components/site/account-menu';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useHiddenListings } from '@/lib/site/client-space';
import { cn } from '@/lib/utils';

/**
 * Toggles hiding a listing from the client's search results.
 * When signed out, clicking redirects to sign-in so the preference is recorded server-side per account.
 */
export function HideButton({ listingId, className }: { listingId: string; className?: string }) {
  const copy = useT().site.listingCard;
  const { signedIn } = useClientSession();
  const { has, hide, unhide } = useHiddenListings(signedIn);
  const pathname = usePathname();
  const router = useRouter();
  const hidden = has(listingId);
  const label = hidden ? copy.unhide : copy.hide;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!signedIn) {
      router.push(accountHref(SIGN_IN_PATH, pathname));
      return;
    }
    if (hidden) {
      void unhide(listingId);
    } else {
      void hide(listingId);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      className={cn('rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card', className)}
      onClick={handleClick}
    >
      <EyeOff aria-hidden="true" className={cn('size-4', hidden && 'text-muted-foreground')} />
    </Button>
  );
}
