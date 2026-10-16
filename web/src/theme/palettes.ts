// Built-in palettes and the rules to resolve a user selection (palette + colour overrides) into a seed.
// To add a palette: append one entry to PALETTES (see README.md). Nothing else needs to change; the
// generator derives every token and the Appearance page lists it automatically.
import { normalizeHex, oklchToHex } from './color';
import { defaultAccent, type ThemeSeed } from './generate';

const ok = (l: number, c: number, h: number) => oklchToHex({ l, c, h });

export type PaletteDef = {
  id: string;
  /** English fallback; translated names live in i18n/messages/LOCALE/appearance.ts keyed by id. */
  label: string;
  description: string;
  seed: ThemeSeed;
};

export const DEFAULT_PALETTE_ID = 'eam-green';

export const PALETTES: readonly PaletteDef[] = [
  {
    id: 'eam-green',
    label: 'EAM Green',
    description: 'The original emerald and white identity.',
    seed: { primary: ok(0.508, 0.118, 165.6), background: ok(0.984, 0.006, 165) },
  },
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    description: 'Clean whites with refined blue accents.',
    seed: { primary: ok(0.52, 0.15, 250), accent: ok(0.7, 0.12, 215), background: ok(0.985, 0.005, 240) },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'A premium dark interface with indigo highlights.',
    seed: {
      primary: ok(0.74, 0.13, 268),
      accent: ok(0.75, 0.1, 210),
      background: ok(0.15, 0.02, 265),
      scheme: 'dark',
      depth: 1,
    },
  },
  {
    id: 'violet',
    label: 'Violet',
    description: 'A modern violet and neutral palette.',
    seed: { primary: ok(0.5, 0.19, 295), accent: ok(0.7, 0.14, 330), background: ok(0.984, 0.005, 300) },
  },
  {
    id: 'warm-amber',
    label: 'Warm Amber',
    description: 'A distinctive amber and warm neutral palette.',
    seed: {
      primary: ok(0.56, 0.13, 60),
      accent: ok(0.72, 0.13, 35),
      background: ok(0.985, 0.008, 85),
      depth: 0.3,
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Minimalist industrial grays with a restrained accent.',
    seed: { primary: ok(0.42, 0.035, 255), accent: ok(0.68, 0.13, 55), background: ok(0.975, 0.004, 255) },
  },
];

export function getPalette(id: string): PaletteDef | undefined {
  return PALETTES.find((palette) => palette.id === id);
}

export function paletteOrDefault(id: string): PaletteDef {
  return getPalette(id) ?? (getPalette(DEFAULT_PALETTE_ID) as PaletteDef);
}

export const COLOR_ROLES = ['primary', 'accent', 'background'] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

/** Colours the user changed on top of a built-in palette. */
export type Overrides = Partial<Record<ColorRole, string>>;

/** What is applied: a built-in palette plus optional colour overrides. */
export type Selection = { baseId: string; overrides: Overrides };

export const DEFAULT_SELECTION: Selection = { baseId: DEFAULT_PALETTE_ID, overrides: {} };

/** Keeps only valid hex overrides, normalised to #rrggbb. */
export function cleanOverrides(overrides: Overrides): Overrides {
  const clean: Overrides = {};
  for (const role of COLOR_ROLES) {
    const hex = overrides[role] ? normalizeHex(overrides[role] as string) : null;
    if (hex) clean[role] = hex;
  }
  return clean;
}

export function seedOf(selection: Selection): ThemeSeed {
  const base = paletteOrDefault(selection.baseId).seed;
  return { ...base, ...cleanOverrides(selection.overrides) };
}

/** True when nothing needs injecting: the CSS defaults in globals.css already are the EAM Green theme. */
export function isDefaultSelection(selection: Selection): boolean {
  return (
    selection.baseId === DEFAULT_PALETTE_ID &&
    COLOR_ROLES.every((role) => !selection.overrides[role])
  );
}

export type EffectiveColors = Record<ColorRole, string>;

/** The three colours the editor shows: overrides first, then the palette, then the derived accent. */
export function effectiveColors(selection: Selection): EffectiveColors {
  const seed = seedOf(selection);
  return {
    primary: seed.primary,
    accent: seed.accent ?? defaultAccent(seed.primary),
    background: seed.background,
  };
}

/** True when the selected palette is dark-native, so applying it should switch the interface to dark. */
export function prefersDark(selection: Selection): boolean {
  return seedOf(selection).scheme === 'dark';
}

/** Same palette and same colours: used to tell an unsaved preview from the saved selection. */
export function sameSelection(a: Selection, b: Selection): boolean {
  if (a.baseId !== b.baseId) return false;
  const [x, y] = [cleanOverrides(a.overrides), cleanOverrides(b.overrides)];
  return COLOR_ROLES.every((role) => x[role] === y[role]);
}
