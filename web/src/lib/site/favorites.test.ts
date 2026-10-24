import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAVORITES, parseFavorites, resetFavoritesCache, toggleId, useFavorites } from './favorites';

const A = '70712abb-68cb-41d4-a655-598b41e43b2a';
const B = 'd43067d5-4835-43d0-ba78-4a5c2df0eb5d';

describe('parseFavorites', () => {
  it('reads a list of ids and ignores anything else', () => {
    expect(parseFavorites(JSON.stringify([A, B, A, 'not-an-id', 42]))).toEqual([A, B]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites(null)).toEqual([]);
  });

  it('keeps at most MAX_FAVORITES', () => {
    const many = Array.from({ length: MAX_FAVORITES + 20 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    expect(parseFavorites(JSON.stringify(many))).toHaveLength(MAX_FAVORITES);
  });
});

describe('toggleId', () => {
  it('adds at the front and removes when present, without touching the input', () => {
    const start = [A];
    expect(toggleId(start, B)).toEqual([B, A]);
    expect(toggleId([B, A], B)).toEqual([A]);
    expect(start).toEqual([A]);
  });
});

describe('useFavorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFavoritesCache();
  });

  it('starts from the stored favorites and toggles them', () => {
    window.localStorage.setItem('emerald.favorites.v1', JSON.stringify([A]));
    resetFavoritesCache();
    const { result } = renderHook(() => useFavorites());
    expect(result.current.ids).toEqual([A]);
    expect(result.current.has(A)).toBe(true);
    expect(result.current.has(B)).toBe(false);

    act(() => result.current.toggle(B));
    expect(result.current.ids).toEqual([B, A]);
    expect(JSON.parse(window.localStorage.getItem('emerald.favorites.v1') ?? '[]')).toEqual([B, A]);

    act(() => result.current.toggle(A));
    expect(result.current.ids).toEqual([B]);
  });
});
