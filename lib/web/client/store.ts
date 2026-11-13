'use client';

import { useSyncExternalStore } from 'react';

/** What is kept about a title in this browser. */
export type Item = { key: string; source: string; id: string; title: string; cover?: string; category: string };
export type Recent = { series: Item; chapterId: string; chapterName: string; page: number; total: number; ts: number };
export type Bookmark = {
  id: string;
  seriesKey: string;
  chapterId: string;
  chapterName: string;
  page: number;
  note: string;
  ts: number;
};

const KEYS = { favorites: 'w_favorites', wishlist: 'w_wishlist', recents: 'w_recents', bookmarks: 'w_bookmarks' } as const;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T;
    const value = raw ? (JSON.parse(raw) as T) : fallback;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the change just isn't kept.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('storage', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', l);
  };
};

const EMPTY: never[] = [];
function useStored<T>(key: string): T[] {
  return useSyncExternalStore(
    subscribe,
    () => read<T[]>(key, EMPTY),
    () => EMPTY,
  );
}

export const useFavorites = () => useStored<Item>(KEYS.favorites);
export const useWishlist = () => useStored<Item>(KEYS.wishlist);
export const useRecents = () => useStored<Recent>(KEYS.recents);
export const useBookmarks = () => useStored<Bookmark>(KEYS.bookmarks);

export function toggleItem(list: 'favorites' | 'wishlist', item: Item) {
  const cur = read<Item[]>(KEYS[list], []);
  write(KEYS[list], cur.some((i) => i.key === item.key) ? cur.filter((i) => i.key !== item.key) : [item, ...cur]);
}

export function saveRecent(r: Omit<Recent, 'ts'>) {
  const cur = read<Recent[]>(KEYS.recents, []);
  write(KEYS.recents, [{ ...r, ts: Date.now() }, ...cur.filter((x) => x.series.key !== r.series.key)].slice(0, 60));
}

export function clearRecents() {
  write(KEYS.recents, []);
}

export function addBookmark(b: Omit<Bookmark, 'id' | 'ts'>) {
  const cur = read<Bookmark[]>(KEYS.bookmarks, []);
  const dup = cur.find((x) => x.seriesKey === b.seriesKey && x.chapterId === b.chapterId && x.page === b.page);
  const next: Bookmark = { ...b, id: dup?.id ?? crypto.randomUUID(), ts: Date.now() };
  write(KEYS.bookmarks, [next, ...cur.filter((x) => x.id !== next.id)]);
}

export function removeBookmark(id: string) {
  write(KEYS.bookmarks, read<Bookmark[]>(KEYS.bookmarks, []).filter((b) => b.id !== id));
}
