"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  /** Visual size. `hero` = oversized landing bar; `compact` = pinned header. */
  size?: "hero" | "compact";
  /** Optional external value binding so the sticky header stays in sync with the
   * hero query when the user transitions between modes. Not required. */
  initialValue?: string;
  /**
   * Active source count. When provided on the hero variant, drives the trailing
   * mono indicator pill showing the live source count. Decorative — no behavior.
   */
  sourceCount?: number;
}

// Overhaul B — rotating placeholders. The hero bar cycles through curated
// queries every ~4s while unfocused so the bar reads as a "command surface"
// inviting input rather than a static text field. The list is intentionally
// short and ordered to surface different intent shapes (free-text, ecosystem,
// concept).
const HERO_PLACEHOLDERS = [
  "Search every open-source platform…",
  "Try `mcp server`",
  "Try `react state management`",
  // Demonstrate the dual word-OR-sentence promise: a full descriptive query
  // works too (the engine reduces it to key terms — see coreSearchQuery).
  "…or describe it: a self-hosted tool to sync notes, end-to-end encrypted",
  "Try `local llm runtime`",
  "Try `rust http framework`",
];

export function SearchBar({
  onSearch,
  isLoading,
  onDebouncedChange,
  debounceMs = 350,
  size = "hero",
  initialValue = "",
  sourceCount,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [pulseKey, setPulseKey] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (mode switch, browser history, clear) back
  // into the local input without forcing controlled re-renders on every key.
  useEffect(() => {
    setQuery(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  // Debounced live-search: emits onDebouncedChange `debounceMs` after the
  // user stops typing. Skipped when no handler is wired.
  useEffect(() => {
    if (!onDebouncedChange) return;
    const handle = setTimeout(() => {
      onDebouncedChange(query);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [query, onDebouncedChange, debounceMs]);

  // "/" focuses the search input (classic Google / GitHub shortcut). Ignored
  // while the user is already typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isCompact = size === "compact";

  // Rotate the hero placeholder every ~4s while the bar is unfocused and
  // empty. Pauses on focus / once the user has typed anything so it
  // doesn't fight live input. Skipped on the compact variant entirely
  // (sticky header has no room for marketing copy).
  useEffect(() => {
    if (isCompact) return;
    if (focused || query.length > 0) return;
    const handle = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % HERO_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(handle);
  }, [isCompact, focused, query]);

  const placeholder = isCompact
    ? "Search open source…"
    : HERO_PLACEHOLDERS[placeholderIdx];
  const iconSize = isCompact ? "w-4 h-4" : "w-5 h-5";

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search open-source projects"
      className={isCompact ? "relative w-full" : "relative max-w-2xl mx-auto w-full"}
    >
      <div
        className={`glass-strong search-bar-shell relative flex items-center ${isCompact ? "compact" : ""}`}
      >
        {/* Focus pulse — framer-motion-driven radial glow; honors
            reduced-motion via the framer provider. One-shot per focus. */}
        <AnimatePresence>
          {!isCompact && (
            <motion.span
              key={pulseKey}
              aria-hidden
              className="search-bar-pulse pointer-events-none absolute inset-0 rounded-full"
              initial={{ opacity: 0.55, scale: 0.98 }}
              animate={{ opacity: 0, scale: 1.04, transition: { duration: 0.7, ease: [0.22, 0.61, 0.36, 1] } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            />
          )}
        </AnimatePresence>

        {/* Leading command-hint pill — the long-standing `/` keyboard
            shortcut surfaced visually as a system indicator. Only on the
            hero variant; the compact bar is too tight. Overhaul D — the
            chip subtly scales + shifts indigo when the bar is focused so
            the leading edge of the search reads as "alive" alongside
            the existing radial focus pulse. */}
        {!isCompact && (
          <motion.span
            className="ts-cmd-hint relative"
            aria-hidden
            title="Press / to focus search"
            animate={{
              scale: focused ? 1.06 : 1,
              backgroundColor: focused
                ? "rgba(99, 102, 241, 0.18)"
                : "rgba(99, 102, 241, 0.10)",
              borderColor: focused
                ? "rgba(99, 102, 241, 0.32)"
                : "rgba(99, 102, 241, 0.14)",
              color: focused ? "#4f46e5" : "var(--ts-text-subtle)",
            }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            /
          </motion.span>
        )}

        <div className="relative pl-0.5 flex items-center">
          <Search className={`${iconSize} text-indigo-500/75`} aria-hidden />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (isCompact) return;
            setPulseKey((k) => k + 1);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
          className="search-bar-input relative flex-1 px-3"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className={`relative flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors ${isCompact ? "w-11 h-11 sm:w-7 sm:h-7" : "w-11 h-11 sm:w-8 sm:h-8"} rounded-full`}
            aria-label="Clear search"
          >
            <X className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden />
          </button>
        )}

        {/* Trailing mono meta — live source count. Hidden on phone widths to
            keep the bar compact (the `/` hint already anchors the left edge). */}
        {!isCompact && typeof sourceCount === "number" && !query && (
          <span className="ts-cmd-meta relative" aria-hidden>
            <span>{sourceCount} sources</span>
          </span>
        )}

        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="sb-submit relative"
        >
          {isLoading ? (
            <>
              <Loader2
                className={`${isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} animate-spin`}
                aria-hidden
              />
              <span>Searching</span>
            </>
          ) : (
            <span>Search</span>
          )}
        </button>
      </div>
    </form>
  );
}
