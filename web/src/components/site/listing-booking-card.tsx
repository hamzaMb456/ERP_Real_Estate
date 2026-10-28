"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Mail, Phone } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { formatTnd } from "@/lib/format";
import { siteConfig } from "@/lib/site/config";
import { mailtoHref, telHref } from "@/lib/site/listing-links";
import type { PublicListing } from "@/lib/site/listings-queries";
import { useClientSession } from "@/components/site/account-menu";
import { accountHref, SIGN_IN_PATH } from "@/lib/site/account";
import { useUnitRequests } from "@/lib/site/use-unit-requests";
import { FavoriteButton } from "./favorite-button";
import { RequestDialog, type RequestKind } from "./request-dialog";
import { ShareButton } from "./share-button";

const CONTACT_LINK =
  "flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none";

/**
 * Sticky card of the unit page: the price, then what the visitor can do: ask to rent (units for rent only), ask for a
 * visit, keep the listing as a favorite, share it, or reach the agency by phone and e-mail. Actions that create a
 * request (rent, visit) require the visitor to be signed in: when they are not, the button links to the sign-in page
 * and returns them here after authentication.
 */
export function ListingBookingCard({ listing }: { listing: PublicListing }) {
  const t = useT().site;
  const copy = t.booking;
  const isRent = listing.kind === "rent";
  const [dialog, setDialog] = useState<RequestKind | null>(null);
  const card = useRef<HTMLElement>(null);
  const [cardVisible, setCardVisible] = useState(true);
  const { signedIn } = useClientSession();
  const pathname = usePathname();
  const signInHref = accountHref(SIGN_IN_PATH, pathname);

  // The server state (persists across reloads) plus an optimistic flag set the moment a request succeeds, so the
  // button disables instantly without waiting on a refetch.
  const { hasRentalRequest, hasVisitRequest } = useUnitRequests(listing.id, signedIn);
  const [justSent, setJustSent] = useState({ rent: false, visit: false });
  const rentSent = hasRentalRequest || justSent.rent;
  // Renting makes visiting moot, so a rent request also disables the visit button.
  const visitSent = hasVisitRequest || rentSent || justSent.visit;
  const handleSubmitted = (kind: RequestKind) =>
    setJustSent((current) => (kind === "rent" ? { rent: true, visit: current.visit } : { ...current, visit: true }));

  // On phones the card sits far down the page: once it scrolls out of view, a bar with the price and the main action stays at the bottom.
  useEffect(() => {
    const update = () => {
      const element = card.current;
      if (!element) return;
      const { top, bottom } = element.getBoundingClientRect();
      setCardVisible(bottom > 0 && top < window.innerHeight);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <>
      <aside
        ref={card}
        aria-labelledby="listing-booking-title"
        data-scroll-item=""
        suppressHydrationWarning
        className="self-start rounded-xl border border-primary/20 bg-card p-6 shadow-xl shadow-primary/10 lg:sticky lg:top-24"
      >
        <div className="border-b border-border pb-5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              data-testid="listing-price"
              dir="ltr"
              className="font-heading-site text-3xl font-extrabold whitespace-nowrap text-primary tabular-nums"
            >
              {formatTnd(listing.price)}
            </span>
            {isRent ? (
              <span className="text-sm font-medium text-muted-foreground">
                {t.listingCard.perMonth}
              </span>
            ) : null}
          </p>
          {isRent && listing.charges !== null && listing.charges > 0 ? (
            <p
              dir="ltr"
              className="mt-1 text-xs font-medium text-muted-foreground"
            >
              {t.listing.contact.chargesExtra(formatTnd(listing.charges))}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 py-5">
          <h2 id="listing-booking-title" className="sr-only">
            {copy.rentCta} / {copy.visitCta}
          </h2>
          {isRent ? (
            signedIn ? (
              <Button
                size="lg"
                className="h-11 w-full"
                disabled={rentSent}
                onClick={() => setDialog("rent")}
              >
                {copy.rentCta}
              </Button>
            ) : (
              <Button asChild size="lg" className="h-11 w-full">
                <Link href={signInHref}>{copy.rentCta}</Link>
              </Button>
            )
          ) : null}
          {signedIn ? (
            <Button
              size="lg"
              variant={isRent ? "outline" : "default"}
              className="h-11 w-full gap-2"
              disabled={visitSent}
              onClick={() => setDialog("visit")}
            >
              <CalendarDays aria-hidden="true" />
              {copy.visitCta}
            </Button>
          ) : (
            <Button asChild size="lg" variant={isRent ? "outline" : "default"} className="h-11 w-full gap-2">
              <Link href={signInHref}>
                <CalendarDays aria-hidden="true" />
                {copy.visitCta}
              </Link>
            </Button>
          )}
          {rentSent ? (
            <p className="text-center text-xs font-medium text-muted-foreground">{copy.alreadyRequestedRent}</p>
          ) : visitSent ? (
            <p className="text-center text-xs font-medium text-muted-foreground">{copy.alreadyRequestedVisit}</p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {copy.reassure}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <FavoriteButton
              listingId={listing.id}
              variant="bar"
              className="w-full min-w-0"
            />
            <ShareButton listingId={listing.id} title={listing.title} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="font-heading-site text-base font-bold text-foreground">
            {copy.contactTitle}
          </h3>
          <a href={telHref(siteConfig.phone)} className={CONTACT_LINK}>
            <Phone
              size={18}
              className="shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="sr-only">{copy.phone} : </span>
            <span dir="ltr" className="tabular-nums">
              {siteConfig.phone}
            </span>
          </a>
          <a href={mailtoHref(siteConfig.email)} className={CONTACT_LINK}>
            <Mail
              size={18}
              className="shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="sr-only">{copy.email} : </span>
            <span dir="ltr" className="truncate">
              {siteConfig.email}
            </span>
          </a>
        </div>

        {dialog !== null ? (
          <RequestDialog
            kind={dialog}
            listing={listing}
            open
            onOpenChange={(open) => !open && setDialog(null)}
            onSubmitted={handleSubmitted}
          />
        ) : null}
      </aside>

      <div
        aria-hidden={cardVisible || dialog !== null}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md transition-transform duration-300 lg:hidden",
          cardVisible || dialog !== null
            ? "pointer-events-none translate-y-full"
            : "translate-y-0",
        )}
      >
        <p className="min-w-0 flex-1">
          <span
            dir="ltr"
            className="font-heading-site block truncate text-lg leading-tight font-extrabold text-primary tabular-nums"
          >
            {formatTnd(listing.price)}
          </span>
          {isRent ? (
            <span className="text-xs text-muted-foreground">
              {t.listingCard.perMonth}
            </span>
          ) : null}
        </p>
        <Button
          asChild
          variant="outline"
          size="icon-lg"
          className="shrink-0"
          tabIndex={cardVisible ? -1 : 0}
        >
          <a href={telHref(siteConfig.phone)} aria-label={copy.phone}>
            <Phone aria-hidden="true" />
          </a>
        </Button>
        {signedIn ? (
          <Button
            size="lg"
            className="h-11 shrink-0"
            tabIndex={cardVisible ? -1 : 0}
            disabled={visitSent}
            onClick={() => setDialog("visit")}
          >
            {copy.visitCta}
          </Button>
        ) : (
          <Button asChild size="lg" className="h-11 shrink-0" tabIndex={cardVisible ? -1 : 0}>
            <Link href={signInHref}>{copy.visitCta}</Link>
          </Button>
        )}
      </div>
    </>
  );
}
