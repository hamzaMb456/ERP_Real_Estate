import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE_ID,
  DEFAULT_SELECTION,
  PALETTES,
  cleanOverrides,
  effectiveColors,
  isDefaultSelection,
  paletteOrDefault,
  prefersDark,
  sameSelection,
  seedOf,
} from './palettes';

describe('palettes', () => {
  it('ships the six required palettes with EAM Green first', () => {
    expect(PALETTES.map((palette) => palette.id)).toEqual(['eam-green', 'ocean-blue', 'midnight', 'violet', 'warm-amber', 'slate']);
    expect(DEFAULT_PALETTE_ID).toBe('eam-green');
  });

  it('falls back to the default palette for unknown ids', () => {
    expect(paletteOrDefault('nope').id).toBe(DEFAULT_PALETTE_ID);
  });

  it('keeps only valid overrides, normalised', () => {
    expect(cleanOverrides({ primary: '#ABC', accent: 'red', background: '' })).toEqual({ primary: '#aabbcc' });
  });

  it('merges overrides over the palette seed', () => {
    const seed = seedOf({ baseId: 'violet', overrides: { primary: '#112233' } });
    expect(seed.primary).toBe('#112233');
    expect(seed.background).toBe(PALETTES[3].seed.background);
  });

  it('knows when nothing needs injecting', () => {
    expect(isDefaultSelection(DEFAULT_SELECTION)).toBe(true);
    expect(isDefaultSelection({ baseId: 'eam-green', overrides: { primary: '#112233' } })).toBe(false);
    expect(isDefaultSelection({ baseId: 'slate', overrides: {} })).toBe(false);
  });

  it('compares selections by palette and colours', () => {
    expect(sameSelection({ baseId: 'slate', overrides: {} }, { baseId: 'slate', overrides: { primary: 'zzz' } })).toBe(true);
    expect(sameSelection({ baseId: 'slate', overrides: {} }, { baseId: 'violet', overrides: {} })).toBe(false);
    expect(sameSelection({ baseId: 'slate', overrides: { primary: '#112233' } }, { baseId: 'slate', overrides: {} })).toBe(false);
  });

  it('derives the accent when the palette sets none', () => {
    expect(effectiveColors(DEFAULT_SELECTION).accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(effectiveColors({ baseId: 'ocean-blue', overrides: {} }).accent).toBe(PALETTES[1].seed.accent);
  });

  it('flags dark-native palettes', () => {
    expect(prefersDark({ baseId: 'midnight', overrides: {} })).toBe(true);
    expect(prefersDark(DEFAULT_SELECTION)).toBe(false);
  });
});
