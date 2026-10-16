import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE_KEY, DEFAULT_PREFS, localThemeStorage } from './storage';
import { THEME_SCRIPT } from './script';

describe('localThemeStorage', () => {
  afterEach(() => window.localStorage.clear());

  it('saves and loads preferences per scope', () => {
    const prefs = { ...DEFAULT_PREFS, selection: { baseId: 'slate', overrides: { primary: '#112233' } } };
    localThemeStorage.save('user-1', prefs);
    expect(localThemeStorage.load('user-1')).toEqual(prefs);
    expect(localThemeStorage.load('user-2')).toBeNull();
  });

  it('ignores corrupt stored data', () => {
    window.localStorage.setItem('erp.theme.v1:user-1', '{not json');
    expect(localThemeStorage.load('user-1')).toBeNull();
  });

  it('mirrors and clears the active theme for the pre-paint script', () => {
    localThemeStorage.writeActive({ id: 'slate', css: 'html:root{--primary:red}' });
    expect(JSON.parse(window.localStorage.getItem(ACTIVE_KEY) as string).id).toBe('slate');
    localThemeStorage.writeActive(null);
    expect(window.localStorage.getItem(ACTIVE_KEY)).toBeNull();
  });
});

describe('THEME_SCRIPT', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.getElementById('erp-theme')?.remove();
    delete document.documentElement.dataset.palette;
  });

  it('injects the saved css and palette id before paint', () => {
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: 'violet', css: 'html:root{--primary:red}' }));
    new Function(THEME_SCRIPT)();
    expect(document.getElementById('erp-theme')?.textContent).toBe('html:root{--primary:red}');
    expect(document.documentElement.dataset.palette).toBe('violet');
  });

  it('does nothing when no theme is saved or the data is corrupt', () => {
    new Function(THEME_SCRIPT)();
    window.localStorage.setItem(ACTIVE_KEY, '{oops');
    new Function(THEME_SCRIPT)();
    expect(document.getElementById('erp-theme')).toBeNull();
  });
});
