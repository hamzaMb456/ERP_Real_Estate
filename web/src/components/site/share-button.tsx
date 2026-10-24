'use client';

import { useState } from 'react';
import { Check, Copy, Phone } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useT } from '@/i18n/provider';

/** The address of the page being shared, read when the visitor asks (never during prerendering). */
const pageUrl = (listingId: string): string => `${window.location.origin}/logement/${listingId}`;

/** WhatsApp "send this text" link: the message and the page address, encoded. */
export const whatsappHref = (message: string, url: string): string => `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;

/** « Partager » menu of the unit page: copy the link, or send it on WhatsApp. */
export function ShareButton({ listingId, title }: { listingId: string; title: string }) {
  const copy = useT().site.share;
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl(listingId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the WhatsApp link still works.
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Copy aria-hidden="true" />
          {copy.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="site-root w-56 space-y-1 p-2">
        <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={() => void copyLink()}>
          {copied ? <Check aria-hidden="true" className="text-success" /> : <Copy aria-hidden="true" />}
          <span role="status">{copied ? copy.copied : copy.copy}</span>
        </Button>
        <Button asChild variant="ghost" className="w-full justify-start gap-2">
          <a href={whatsappHref(copy.message(title), typeof window === 'undefined' ? '' : pageUrl(listingId))} target="_blank" rel="noopener noreferrer">
            <Phone aria-hidden="true" />
            {copy.whatsapp}
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
