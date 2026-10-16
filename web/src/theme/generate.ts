// Turns a palette seed (three colours) into the complete token set the interface reads, for light and dark.
// Every surface, border, text and sidebar colour is derived from the seed with one recipe, so a custom
// colour gets the same coherence as a built-in palette. Status colours (destructive, success, warning,
// info) are NOT generated: they keep their meaning whatever the palette.
//
// The default EAM Green palette lives in globals.css; it is the fallback when nothing is injected.
import { contrast, css, ensureContrast, hexToOklch, hueDistance, oklchToHex, type Oklch } from './color';

export type Scheme = 'light' | 'dark';

export type ThemeSeed = {
  /** Brand colour: buttons, links, focus, charts. Adjusted for contrast when needed. */
  primary: string;
  /** Secondary highlight (hover tints, sidebar glow). Omitted = follows the primary hue. */
  accent?: string;
  /** Page colour of the palette's native scheme. */
  background: string;
  /** Scheme the colours were designed for. A dark palette makes the app switch to dark when applied. */
  scheme?: Scheme;
  /** 0..1: how much darker the sidebar panel is than the standard one. */
  depth?: number;
};

export type TokenMap = Record<string, string>;

export type GeneratedTheme = {
  light: TokenMap;
  dark: TokenMap;
  /** Ready to inject in a <style> tag; selectors outrank the defaults in globals.css. */
  css: string;
  /** True when a colour had to be moved to stay readable (WCAG AA). */
  primaryAdjusted: boolean;
};

const FALLBACK_PRIMARY: Oklch = { l: 0.508, c: 0.118, h: 165.6 };
const FALLBACK_BACKGROUND: Oklch = { l: 0.984, c: 0.006, h: 165 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const o = (l: number, c: number, h: number, alpha = 1) => css(l, c, h, alpha);

/** Categorical hues for chart slots 2..5, nudged away from the primary so series stay distinguishable. */
function categoricalHues(primaryHue: number): number[] {
  const preferred = [205, 80, 25, 275];
  const pool = [145, 320, 165, 205, 80, 25, 275];
  const chosen: number[] = [];
  return preferred.map((hue) => {
    const pick =
      [hue, ...pool].find(
        (candidate) => hueDistance(candidate, primaryHue) >= 35 && chosen.every((c) => hueDistance(c, candidate) >= 25),
      ) ?? hue;
    chosen.push(pick);
    return pick;
  });
}

export function generateTheme(seed: ThemeSeed): GeneratedTheme {
  const native = seed.scheme ?? 'light';
  const P = hexToOklch(seed.primary) ?? FALLBACK_PRIMARY;
  const B = hexToOklch(seed.background) ?? FALLBACK_BACKGROUND;
  const explicitAccent = seed.accent ? hexToOklch(seed.accent) : null;
  const A: Oklch = explicitAccent ?? derivedAccent(P);

  const ph = P.h;
  const surfaceAccentHue = explicitAccent ? A.h : ph; // hover tints stay in the brand hue unless told otherwise
  const accentChroma = explicitAccent ? A.c : P.c;
  const nh = B.c < 0.002 ? ph : B.h;
  const nc = clamp(B.c, 0.003, 0.03);
  const depth = clamp(seed.depth ?? 0, 0, 1);
  const s = clamp(P.c / 0.118, 0.3, 1.5); // sidebar chroma scale against the EAM green reference
  const sv = Math.min(s, 1.35);

  const bgLight: Oklch =
    native === 'light' ? { l: B.l, c: B.c, h: nh } : { l: 0.984, c: clamp(nc * 0.4, 0.004, 0.012), h: nh };
  const bgDark: Oklch =
    native === 'dark' ? { l: B.l, c: B.c, h: nh } : { l: 0.17, c: clamp(nc * 2.5, 0.012, 0.03), h: nh };

  const hues = categoricalHues(ph);
  const chart1Base = P.c >= 0.06 ? P : A;

  let primaryAdjusted = false;

  const build = (mode: Scheme): TokenMap => {
    const light = mode === 'light';
    const bg = light ? bgLight : bgDark;
    const card: Oklch = light
      ? { l: Math.min(1, bg.l + 0.016), c: bg.c * 0.25, h: bg.h }
      : { l: bg.l + 0.04, c: bg.c * 1.2, h: bg.h };
    const popover: Oklch = light ? card : { l: bg.l + 0.05, c: card.c, h: bg.h };

    const fg = ensureContrast(light ? { l: 0.2, c: 0.02, h: nh } : { l: 0.96, c: 0.01, h: nh }, bg, 7).color;
    const mutedFg = ensureContrast(light ? { l: 0.47, c: 0.025, h: nh } : { l: 0.72, c: 0.03, h: nh }, bg, 4.5).color;

    const primaryBase: Oklch = light
      ? native === 'light'
        ? P
        : { ...P, l: Math.min(P.l, 0.55) }
      : native === 'dark'
        ? P
        : { l: P.l < 0.66 ? 0.7 : P.l, c: Math.min(P.c * 1.17, 0.2), h: P.h };
    const ensured = ensureContrast(primaryBase, card, 4.5);
    primaryAdjusted = primaryAdjusted || ensured.adjusted;
    const primary = ensured.color;
    const onLight: Oklch = { l: 0.985, c: 0.01, h: ph };
    const onDark: Oklch = { l: 0.2, c: 0.03, h: ph };
    const primaryFg = contrast(onLight, primary) >= contrast(onDark, primary) ? onLight : onDark;

    const accentSurface: Oklch = light
      ? { l: Math.min(0.948, bg.l - 0.036), c: clamp(accentChroma * 0.3, 0.02, 0.045), h: surfaceAccentHue }
      : { l: 0.3, c: clamp(accentChroma * 0.38, 0.025, 0.06), h: surfaceAccentHue };
    const accentFg: Oklch = light
      ? { l: 0.34, c: clamp(accentChroma * 0.72, 0.03, 0.1), h: surfaceAccentHue }
      : { l: 0.92, c: 0.05, h: surfaceAccentHue };

    const ringChroma = Math.max(P.c * 1.1, 0.05);
    const chartChroma = clamp(chart1Base.c, 0.09, 0.18);
    const border = light ? o(bg.l - 0.069, clamp(nc * 2.5, 0.008, 0.02), nh) : 'oklch(1 0 0 / 10%)';
    return {
      '--background': o(bg.l, bg.c, bg.h),
      '--foreground': o(fg.l, fg.c, fg.h),
      '--card': o(card.l, card.c, card.h),
      '--card-foreground': o(fg.l, fg.c, fg.h),
      '--popover': o(popover.l, popover.c, popover.h),
      '--popover-foreground': o(fg.l, fg.c, fg.h),
      '--primary': o(primary.l, primary.c, primary.h),
      '--primary-foreground': o(primaryFg.l, primaryFg.c, primaryFg.h),
      '--secondary': light ? o(bg.l - 0.029, clamp(nc * 2.5, 0.008, 0.02), nh) : o(bg.l + 0.1, 0.02, nh),
      '--secondary-foreground': light ? o(0.3, clamp(P.c * 0.34, 0.02, 0.05), ph) : o(0.96, 0.01, nh),
      '--muted': light ? o(bg.l - 0.022, clamp(nc * 1.6, 0.006, 0.012), nh) : o(bg.l + 0.09, 0.018, nh),
      '--muted-foreground': o(mutedFg.l, mutedFg.c, mutedFg.h),
      '--accent': o(accentSurface.l, accentSurface.c, accentSurface.h),
      '--accent-foreground': o(accentFg.l, accentFg.c, accentFg.h),
      '--border': border,
      '--input': light ? o(0.8, 0.02, nh) : 'oklch(1 0 0 / 14%)',
      '--ring': o(light ? 0.6 : 0.65, ringChroma, ph),
      '--chart-1': o(light ? 0.6 : 0.7, chartChroma, chart1Base.h),
      '--chart-2': o(light ? 0.7 : 0.75, 0.11, hues[0]),
      '--chart-3': o(light ? 0.78 : 0.82, 0.15, hues[1]),
      '--chart-4': o(light ? 0.65 : 0.72, 0.18, hues[2]),
      '--chart-5': o(light ? 0.58 : 0.68, 0.15, hues[3]),
      '--sidebar': light ? o(0.992, 0.004, nh) : o(bg.l + 0.03, 0.016, nh),
      '--sidebar-foreground': light ? o(0.28, 0.02, ph) : o(0.94, 0.01, ph),
      '--sidebar-primary': o(primary.l, primary.c, primary.h),
      '--sidebar-primary-foreground': o(primaryFg.l, primaryFg.c, primaryFg.h),
      '--sidebar-accent': o(accentSurface.l, accentSurface.c, accentSurface.h),
      '--sidebar-accent-foreground': o(accentFg.l, accentFg.c, accentFg.h),
      '--sidebar-border': border,
      '--sidebar-ring': o(light ? 0.6 : 0.65, ringChroma, ph),
      // The sidebar is a dark glass panel in both schemes; these feed the aurora, active item and logo.
      '--theme-hue': String(Math.round(ph * 10) / 10),
      '--sidebar-panel': o(0.25 - 0.07 * depth, 0.055 * s, ph),
      '--sidebar-fg': o(0.95, 0.02, ph),
      '--sidebar-glow-a': o(0.62, 0.15 * sv, ph, 0.45),
      '--sidebar-glow-b': o(0.7, 0.13 * sv, A.h, 0.28),
      '--sidebar-grad-top': o(0.3 - 0.08 * depth, 0.06 * s, ph),
      '--sidebar-grad-bottom': o(0.2 - 0.06 * depth, 0.045 * s, ph + 10),
      '--sidebar-active-from': o(0.7, 0.16 * sv, ph),
      '--sidebar-active-to': o(0.5, 0.13 * sv, ph + 3),
      '--sidebar-active-glow': o(0.72, 0.17 * sv, ph, 0.6),
      '--sidebar-marker': o(0.85, 0.16 * sv, ph),
      '--sidebar-muted': o(0.8, 0.045 * s, ph),
      '--sidebar-ring-panel': o(0.82, 0.12 * sv, ph),
      '--sidebar-logo': o(0.68, 0.16 * sv, ph),
    };
  };

  const lightTokens = build('light');
  const darkTokens = build('dark');
  return {
    light: lightTokens,
    dark: darkTokens,
    css: `html:root{${serialize(lightTokens)}}html.dark{${serialize(darkTokens)}}`,
    primaryAdjusted,
  };
}

function serialize(tokens: TokenMap): string {
  return Object.entries(tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

function derivedAccent(primary: Oklch): Oklch {
  return { l: 0.7, c: clamp(primary.c, 0.06, 0.14), h: primary.h + 25 };
}

/** Accent shown (and used for the sidebar glow) when a palette sets none: the primary hue shifted by 25 degrees. */
export function defaultAccent(primaryHex: string): string {
  return oklchToHex(derivedAccent(hexToOklch(primaryHex) ?? FALLBACK_PRIMARY));
}
