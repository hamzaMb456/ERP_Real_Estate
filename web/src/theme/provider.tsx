'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/auth-provider';
import { generateTheme, type GeneratedTheme } from './generate';
import { isDefaultSelection, prefersDark, seedOf, type Selection } from './palettes';
import { ANONYMOUS_SCOPE } from './storage';
import {
  activateScope,
  currentSelection,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type AppearanceState,
} from './store';

const STYLE_ID = 'erp-theme';

/** Writes the selection into the document: one <style> with the tokens, and data-palette on <html>. */
export function applyToDocument(selection: Selection): GeneratedTheme | null {
  const root = document.documentElement;
  const existing = document.getElementById(STYLE_ID);
  if (isDefaultSelection(selection)) {
    existing?.remove();
    delete root.dataset.palette;
    return null;
  }
  const theme = generateTheme(seedOf(selection));
  const element = existing ?? Object.assign(document.createElement('style'), { id: STYLE_ID });
  if (!existing) document.head.appendChild(element);
  element.textContent = theme.css;
  root.dataset.palette = selection.baseId;
  return theme;
}

/** Renders nothing: loads the signed-in user's preferences and keeps the document in sync with them. */
export function AppearanceSync() {
  const { session, ready } = useAuth();
  const { setTheme } = useTheme();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (ready) activateScope(userId ?? ANONYMOUS_SCOPE);
  }, [ready, userId]);

  const loaded = state.scope !== null;
  const selection = currentSelection(state);

  useEffect(() => {
    if (loaded) applyToDocument(selection);
  }, [loaded, selection]);

  // A dark palette (Midnight) switches the interface to dark when it is chosen, not on every page load,
  // so a user who then picks Light mode by hand is not overruled.
  const previousBase = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (previousBase.current !== null && previousBase.current !== selection.baseId && prefersDark(selection)) {
      setTheme('dark');
    }
    previousBase.current = selection.baseId;
  }, [loaded, selection, setTheme]);

  return null;
}

/** Appearance state for components: the saved preferences plus the selection currently on screen. */
export function useAppearance(): AppearanceState & { ready: boolean; current: Selection } {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...state, ready: state.scope !== null, current: currentSelection(state) };
}
