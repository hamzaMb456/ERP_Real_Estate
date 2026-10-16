import { beforeEach, describe, expect, it } from 'vitest';
import { ANONYMOUS_SCOPE, DEFAULT_PREFS, parsePrefs, type ActiveTheme, type ThemePrefs, type ThemeStorage } from './storage';
import {
  activateScope,
  applySelection,
  cancelPreview,
  currentSelection,
  getSnapshot,
  previewSelection,
  removePalette,
  resetSelection,
  resetStoreForTests,
  savePalette,
} from './store';

function memoryStorage() {
  const prefs = new Map<string, ThemePrefs>();
  const state: { active: ActiveTheme | null } = { active: null };
  const storage: ThemeStorage = {
    load: (scope) => prefs.get(scope) ?? null,
    save: (scope, value) => {
      prefs.set(scope, value);
    },
    writeActive: (active) => {
      state.active = active;
    },
  };
  return { storage, prefs, state };
}

describe('appearance store', () => {
  let mem: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    mem = memoryStorage();
    resetStoreForTests(mem.storage);
    activateScope('user-1');
  });

  it('starts on the default selection', () => {
    expect(getSnapshot().prefs.selection).toEqual(DEFAULT_PREFS.selection);
    expect(mem.state.active).toBeNull();
  });

  it('previews without persisting, then applies and persists', () => {
    previewSelection({ baseId: 'ocean-blue', overrides: {} });
    expect(currentSelection(getSnapshot()).baseId).toBe('ocean-blue');
    expect(mem.prefs.get('user-1')).toBeUndefined();

    applySelection({ baseId: 'ocean-blue', overrides: { primary: '#112233' } });
    expect(getSnapshot().preview).toBeNull();
    expect(mem.prefs.get('user-1')?.selection.overrides.primary).toBe('#112233');
    expect(mem.state.active?.css).toContain('html:root{');
    expect(mem.state.active?.id).toBe('ocean-blue+custom');
  });

  it('drops a preview on cancel', () => {
    previewSelection({ baseId: 'slate', overrides: {} });
    cancelPreview();
    expect(currentSelection(getSnapshot()).baseId).toBe('eam-green');
  });

  it('restores the default and clears the mirrored css', () => {
    applySelection({ baseId: 'violet', overrides: {} });
    resetSelection();
    expect(getSnapshot().prefs.selection.baseId).toBe('eam-green');
    expect(mem.state.active).toBeNull();
  });

  it('saves, replaces by name, and removes palettes', () => {
    const first = savePalette('Agence', { baseId: 'slate', overrides: {} });
    const second = savePalette('agence', { baseId: 'violet', overrides: {} });
    expect(second?.id).toBe(first?.id);
    expect(getSnapshot().prefs.saved).toHaveLength(1);
    expect(getSnapshot().prefs.saved[0].baseId).toBe('violet');
    expect(savePalette('   ', { baseId: 'slate', overrides: {} })).toBeNull();
    removePalette(first!.id);
    expect(getSnapshot().prefs.saved).toHaveLength(0);
  });

  it('keeps each user preferences apart and lets a new user inherit the signed-out choice', () => {
    resetStoreForTests(mem.storage);
    activateScope(ANONYMOUS_SCOPE);
    applySelection({ baseId: 'warm-amber', overrides: {} });
    activateScope('user-2');
    expect(getSnapshot().prefs.selection.baseId).toBe('warm-amber');
    applySelection({ baseId: 'slate', overrides: {} });
    activateScope('user-3');
    expect(getSnapshot().prefs.selection.baseId).toBe('warm-amber');
    expect(mem.prefs.get('user-2')?.selection.baseId).toBe('slate');
  });
});

describe('parsePrefs', () => {
  it('returns defaults for junk and drops unknown palettes and bad colours', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    const parsed = parsePrefs({
      selection: { baseId: 'ghost', overrides: { primary: 'xyz', accent: '#ABCDEF' } },
      saved: [{ id: 'a', name: '  Mine  ', baseId: 'slate', overrides: {} }, { id: 5 }, null],
    });
    expect(parsed.selection).toEqual({ baseId: 'eam-green', overrides: { accent: '#abcdef' } });
    expect(parsed.saved).toEqual([{ id: 'a', name: 'Mine', baseId: 'slate', overrides: {} }]);
  });
});
