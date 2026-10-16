import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/auth-provider';
import { MotionProvider } from '@/components/motion/primitives';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEFAULT_LOCALE, LOCALE_SCRIPT, dirOf } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { cn } from '@/lib/utils';
import { AppearanceSync } from '@/theme/provider';
import { THEME_SCRIPT } from '@/theme/script';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const notoArabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic' });

export const metadata: Metadata = {
  title: 'ERP Immobilier',
  description: 'Gestion immobilière : biens, baux, finance, maintenance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Always French on the server; the inline script and I18nProvider switch lang/dir to the saved language before paint.
  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={dirOf(DEFAULT_LOCALE)}
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable, notoArabic.variable)}
    >
      <body>
        <Script id="locale" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
        <Script id="palette" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <I18nProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <MotionProvider>
              <TooltipProvider delayDuration={150}>
                <AuthProvider>
                  <AppearanceSync />
                  {children}
                </AuthProvider>
              </TooltipProvider>
            </MotionProvider>
            <Toaster richColors />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
