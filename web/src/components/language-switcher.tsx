'use client';

import { Languages } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';

/** Language picker. `icon` fits the app header; `labeled` shows the current language name (sign-in page). */
export function LanguageSwitcher({
  variant = 'icon',
  className,
  contentClassName,
}: {
  variant?: 'icon' | 'labeled';
  className?: string;
  /** Class for the dropdown panel (it renders in a portal, outside any wrapper such as `.site-root`). */
  contentClassName?: string;
}) {
  const { locale, t, setLocale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="icon" aria-label={t.shell.language.change} className={className}>
            <Languages />
          </Button>
        ) : (
          <Button variant="outline" size="sm" aria-label={t.shell.language.change} className={className}>
            <Languages data-icon="inline-start" />
            <span lang={locale}>{LOCALE_NAMES[locale]}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => isLocale(value) && setLocale(value)}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {LOCALE_NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
