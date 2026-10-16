// Module-level store for the appearance preferences, read with useSyncExternalStore (same pattern as
// i18n/store.ts). Holds three things: the persisted preferences, the signed-in scope they belong to,
// and an optional live preview that is shown but not saved until applySelection is called.
import { generateTheme } from './generate';
import {
  DEFAULT_PALETTE_ID,
  DEFAULT_SELECTION,
  cleanOverrides,
  getPalette,
  isDefaultSelection,
  seedOf,
  type Selection,
} from './palettes';
import {
  ANONYMOUS_SCOPE,
  DEFAULT_PREFS,
  MAX_NAME_LENGTH,
  MAX_SAVED_PALETTES,
  localThemeStorage,
  type SavedPalette,
  type ThemePrefs,
  type ThemeStorage,
} from './storage';

export type AppearanceState = {
  /** Who the preferences belong to; null until the session is known. */
  scope: string | null;
  prefs: ThemePrefs;
  preview: Selection | null;
};

const INITIAL: AppearanceState = { scope: null, prefs: DEFAULT_PREFS, preview: null };

let state: AppearanceState = INITIAL;
let storage: ThemeStorage = localThemeStorage;
const listeners = new Set<() => void>();

function commit(next: AppearanceState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSnapshot = (): AppearanceState => state;
export const getServerSnapshot = (): AppearanceState => INITIAL;

/** The selection on screen: the preview when one is open, the saved one otherwise. */
export function currentSelection(value: AppearanceState): Selection {
  return value.preview ?? value.prefs.selection;
}

function normalize(selection: Selection): Selection {
  return {
    baseId: getPalette(selection.baseId) ? selection.baseId : DEFAULT_PALETTE_ID,
    overrides: cleanOverrides(selection.overrides),
  };
}

function mirrorActive(selection: Selection) {
  if (isDefaultSelection(selection)) {
    storage.writeActive(null);
    return;
  }
  const custom = Object.keys(selection.overrides).length > 0;
  storage.writeActive({ id: selection.baseId + (custom ? '+custom' : ''), css: generateTheme(seedOf(selection)).css });
}

function persist(prefs: ThemePrefs) {
  if (state.scope) storage.save(state.scope, prefs);
  mirrorActive(prefs.selection);
}

/**
 * Loads the preferences of a user. A first sign-in inherits what was chosen while signed out, so
 * the look picked on the sign-in page is not lost.
 */
export function activateScope(scope: string) {
  if (state.scope === scope) return;
  const loaded =
    storage.load(scope) ?? (scope !== ANONYMOUS_SCOPE ? storage.load(ANONYMOUS_SCOPE) : null) ?? DEFAULT_PREFS;
  commit({ scope, prefs: loaded, preview: null });
  mirrorActive(loaded.selection);
}

export function previewSelection(selection: Selection) {
  commit({ ...state, preview: normalize(selection) });
}

export function cancelPreview() {
  if (state.preview) commit({ ...state, preview: null });
}

export function applySelection(selection: Selection) {
  const prefs: ThemePrefs = { ...state.prefs, selection: normalize(selection) };
  commit({ ...state, prefs, preview: null });
  persist(prefs);
}

export function resetSelection() {
  applySelection(DEFAULT_SELECTION);
}

/** Saves a selection under a name (same name replaces). Returns null for an empty name. */
export function savePalette(name: string, selection: Selection): SavedPalette | null {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!clean) return null;
  const existing = state.prefs.saved.find((entry) => entry.name.toLowerCase() === clean.toLowerCase());
  const entry: SavedPalette = { ...normalize(selection), id: existing?.id ?? 'saved-' + Date.now().toString(36), name: clean };
  const others = state.prefs.saved.filter((item) => item.id !== entry.id);
  const prefs: ThemePrefs = { ...state.prefs, saved: [...others, entry].slice(-MAX_SAVED_PALETTES) };
  commit({ ...state, prefs });
  persist(prefs);
  return entry;
}

export function removePalette(id: string) {
  const prefs: ThemePrefs = { ...state.prefs, saved: state.prefs.saved.filter((entry) => entry.id !== id) };
  commit({ ...state, prefs });
  persist(prefs);
}

/** Test seam: swaps the storage and forgets the loaded scope. */
export function resetStoreForTests(nextStorage: ThemeStorage = localThemeStorage) {
  storage = nextStorage;
  state = INITIAL;
  listeners.clear();
}
