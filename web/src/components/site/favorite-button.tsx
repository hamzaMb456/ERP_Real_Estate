'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Heart } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { useClientSession } from '@/components/site/account-menu';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useFavorites } from '@/lib/site/favorites';
import { cn } from '@/lib/utils';

/**
 * The heart of a listing: adds it to, or removes it from, the visitor's favorites. When signed out the button
 * redirects to the sign-in page so the visitor can authenticate first.
 */
export function FavoriteButton({ listingId, variant = 'card', className }: { listingId: string; variant?: 'card' | 'bar'; className?: string }) {
  const copy = useT().site.booking;
  const { signedIn } = useClientSession();
  const { has, toggle } = useFavorites();
  const pathname = usePathname();
  const router = useRouter();
  const active = has(listingId);
  const label = active ? copy.favouriteRemove : copy.favouriteAdd;

  const handleClick = () => {
    if (!signedIn) {
      router.push(accountHref(SIGN_IN_PATH, pathname));
      return;
    }
    toggle(listingId);
  };

  return (
    <Button
      type="button"
      variant={variant === 'card' ? 'secondary' : 'outline'}
      size={variant === 'card' ? 'icon' : 'default'}
      aria-label={variant === 'card' ? label : undefined}
      aria-pressed={active}
      className={cn(variant === 'card' ? 'rounded-full bg-card/90 text-foreground shadow-sm' : 'gap-2', className)}
      onClick={handleClick}
    >
      <Heart aria-hidden="true" className={cn(signedIn && active && 'fill-current text-destructive')} />
      {variant === 'bar' ? label : null}
    </Button>
  );
}