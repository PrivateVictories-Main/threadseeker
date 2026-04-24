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
}

export function SearchBar({
  onSearch,
  isLoading,
  onDebouncedChange,
  debounceMs = 350,
  size = "hero",
  initialValue = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [pulseKey, setPulseKey] = useState(0);
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
  const placeholder = isCompact
    ? "Search open source…"
    : "Search across 28 open source platforms…";
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
        <div className="relative pl-0.5">
          <Search className={`${iconSize} text-indigo-500/75`} aria-hidden />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (isCompact) return;
            setPulseKey((k) => k + 1);
          }}
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
            className={`relative flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors ${isCompact ? "w-9 h-9 sm:w-7 sm:h-7" : "w-11 h-11 sm:w-8 sm:h-8"} rounded-full`}
            aria-label="Clear search"
          >
            <X className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden />
          </button>
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
