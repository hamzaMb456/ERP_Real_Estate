import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHash, useHashTab } from './use-hash';

const TABS = ['apercu', 'proprietaires'] as const;

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useHash / useHashTab', () => {
  it('reads the current hash and falls back for unknown tabs', () => {
    window.history.replaceState(null, '', '/x#nope');
    const { result } = renderHook(() => useHashTab(TABS, 'apercu'));
    expect(result.current[0]).toBe('apercu');
  });

  it('switches tab and updates the URL without reloading', () => {
    const { result } = renderHook(() => useHashTab(TABS, 'apercu'));
    act(() => result.current[1]('proprietaires'));
    expect(result.current[0]).toBe('proprietaires');
    expect(window.location.hash).toBe('#proprietaires');
  });

  it('clears the hash with an empty value', () => {
    const { result } = renderHook(() => useHash());
    act(() => result.current[1]('modifier'));
    expect(result.current[0]).toBe('modifier');
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(window.location.hash).toBe('');
  });
});
