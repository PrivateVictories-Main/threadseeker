// Tiny localStorage-backed bookmark store for "save for later" on result cards.
// We store the full UnifiedProject so the landing-page "Saved" section can
// render without a network round-trip. Capped at MAX to avoid runaway growth.

import type { UnifiedProject } from "./sources";

const KEY = "threadseeker:bookmarks:v1";
const MAX = 100;

export interface StoredBookmark extends UnifiedProject {
  savedAt: number; // epoch ms, for recency sort
}

function safeParse(raw: string | null): StoredBookmark[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function getBookmarks(): StoredBookmark[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(KEY));
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().some((b) => b.id === id);
}

export function addBookmark(project: UnifiedProject): StoredBookmark[] {
  const current = getBookmarks().filter((b) => b.id !== project.id);
  const next = [{ ...project, savedAt: Date.now() }, ...current].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — silently ignore, the in-memory list is still truthy */
  }
  return next;
}

export function removeBookmark(id: string): StoredBookmark[] {
  const next = getBookmarks().filter((b) => b.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function toggleBookmark(project: UnifiedProject): StoredBookmark[] {
  return isBookmarked(project.id) ? removeBookmark(project.id) : addBookmark(project);
}

// Fired whenever the list mutates in this tab. Lightweight alternative to
// context — components subscribe with a useEffect.
const EVENT = "threadseeker:bookmarks-changed";

export function emitBookmarksChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onBookmarksChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const sync = () => handler();
  window.addEventListener(EVENT, sync);
  // Also fire on cross-tab storage events so two open tabs stay in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) handler();
  });
  return () => window.removeEventListener(EVENT, sync);
}
