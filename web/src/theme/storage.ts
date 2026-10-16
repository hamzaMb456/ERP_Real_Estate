// Persistence of the appearance preferences. Browser localStorage today, one key per signed-in user so
// each person keeps their own look on a shared machine. The ThemeStorage interface is the seam to move
// the same JSON to a database column (for example a user_preferences table) without touching the UI.
import { cleanOverrides, getPalette, DEFAULT_PALETTE_ID, DEFAULT_SELECTION, type Selection } from './palettes';

/** A palette the user saved under a name, to reuse later. */
export type SavedPalette = Selection & { id: string; name: string };

export type ThemePrefs = {
  version: 1;
  /** What is applied now. */
  selection: Selection;
  saved: SavedPalette[];
};

export const DEFAULT_PREFS: ThemePrefs = { version: 1, selection: DEFAULT_SELECTION, saved: [] };

export const MAX_SAVED_PALETTES = 24;
export const MAX_NAME_LENGTH = 40;

/** What the inline script in <head> reads to paint the saved theme before React starts. */
export const ACTIVE_KEY = 'erp.theme.active';
export type ActiveTheme = { id: string; css: string };

const PREFS_KEY_PREFIX = 'erp.theme.v1:';
export const ANONYMOUS_SCOPE = 'anonymous';

export interface ThemeStorage {
  load(scope: string): ThemePrefs | null;
  save(scope: string, prefs: ThemePrefs): void;
  /** Mirrors the applied theme for the pre-paint script; null clears it (default theme). */
  writeActive(active: ActiveTheme | null): void;
}

function sanitizeSelection(raw: unknown): Selection {
  const value = (raw ?? {}) as Partial<Selection>;
  const baseId = typeof value.baseId === 'string' && getPalette(value.baseId) ? value.baseId : DEFAULT_PALETTE_ID;
  const overrides = cleanOverrides(value.overrides && typeof value.overrides === 'object' ? value.overrides : {});
  return { baseId, overrides };
}

/** Accepts anything read from storage and returns valid preferences (unknown ids and bad colours dropped). */
export function parsePrefs(raw: unknown): ThemePrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const value = raw as Partial<ThemePrefs>;
  const saved = Array.isArray(value.saved) ? value.saved : [];
  return {
    version: 1,
    selection: sanitizeSelection(value.selection),
    saved: saved
      .filter((entry): entry is SavedPalette => !!entry && typeof entry.id === 'string' && typeof entry.name === 'string')
      .slice(0, MAX_SAVED_PALETTES)
      .map((entry) => ({ ...sanitizeSelection(entry), id: entry.id, name: entry.name.trim().slice(0, MAX_NAME_LENGTH) })),
  };
}

export const localThemeStorage: ThemeStorage = {
  load(scope) {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY_PREFIX + scope);
      return raw ? parsePrefs(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(scope, prefs) {
    try {
      window.localStorage.setItem(PREFS_KEY_PREFIX + scope, JSON.stringify(prefs));
    } catch {
      // Storage full or blocked (private mode): the theme still applies for this session.
    }
  },
  writeActive(active) {
    try {
      if (active) window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
      else window.localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // see above
    }
  },
};
