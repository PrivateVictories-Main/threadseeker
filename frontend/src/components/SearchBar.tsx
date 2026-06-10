"use client";

import {
  useState,
  FormEvent,
  useEffect,
  useRef,
  useMemo,
  useId,
} from "react";
import { Search, Loader2, X, Clock, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getSuggestions } from "@/lib/suggestions";

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
  /** Recent searches — surfaced (when they match) in the autocomplete dropdown. */
  history?: string[];
}

// Overhaul B — rotating placeholders. The hero bar cycles through curated
// queries every ~4s while unfocused so the bar reads as a "command surface"
// inviting input rather than a static text field.
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
  history = [],
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [pulseKey, setPulseKey] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [multiline, setMultiline] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();
  const isCompact = size === "compact";

  // The bar is a textarea so a 2-3 sentence description is a first-class
  // query, not an overflow accident. It starts as a one-line pill and grows
  // with the content (Enter searches, Shift+Enter adds a line) up to a cap,
  // after which it scrolls. Measured via scrollHeight on every value change.
  const MAX_LINES = isCompact ? 2 : 5;
  const LINE_PX = isCompact ? 20 : 26;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // An empty value is ALWAYS single-line: a long placeholder wraps on
    // narrow viewports and inflates scrollHeight, which used to flip the
    // empty bar into its "multi-line draft" state (hint + relaxed radius).
    if (!query) {
      el.style.height = `${LINE_PX}px`;
      el.style.overflowY = "hidden";
      setMultiline(false);
      return;
    }
    el.style.height = "auto";
    const cap = MAX_LINES * LINE_PX;
    const next = Math.min(el.scrollHeight, cap);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
    setMultiline(next > LINE_PX + 2);
  }, [query, focused, MAX_LINES, LINE_PX]);

  // Autocomplete suggestions — only while the user is actually typing.
  const suggestions = useMemo(
    () => (query.trim() ? getSuggestions(query.trim(), history, isCompact ? 6 : 7) : []),
    [query, history, isCompact],
  );
  const showDropdown = open && focused && suggestions.length > 0;

  // Keep the active option in range as the list changes.
  useEffect(() => {
    setActiveIndex((i) => (i >= suggestions.length ? suggestions.length - 1 : i));
  }, [suggestions.length]);

  // Sync external value changes (mode switch, browser history, clear) back
  // into the local input without forcing controlled re-renders on every key.
  useEffect(() => {
    setQuery(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const runSearch = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setQuery(v);
    setOpen(false);
    setActiveIndex(-1);
    onSearch(v);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      runSearch(suggestions[activeIndex].text);
    } else {
      runSearch(query);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // In a textarea, Enter inserts a newline by default — here plain Enter
    // searches (matching every search product) and Shift+Enter keeps the
    // newline for people writing a multi-sentence description. The
    // isComposing guard keeps IME confirmation (Japanese/Chinese/Korean)
    // from firing a premature search.
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        runSearch(suggestions[activeIndex].text);
      } else {
        runSearch(query);
      }
      return;
    }
    // Arrow keys drive the suggestion list only while the value is a single
    // line; once the draft is multi-line — by literal newline OR by soft
    // wrap (the measured `multiline` state) — arrows must move the caret
    // like any editor.
    const valueIsMultiline = multiline || query.includes("\n");
    if (e.key === "ArrowDown" && !valueIsMultiline) {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp" && !valueIsMultiline) {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    }
  };

  // Debounced live-search.
  useEffect(() => {
    if (!onDebouncedChange) return;
    const handle = setTimeout(() => onDebouncedChange(query), debounceMs);
    return () => clearTimeout(handle);
  }, [query, onDebouncedChange, debounceMs]);

  // "/" focuses the search input.
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

  // Rotate the hero placeholder while unfocused + empty.
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
        className={`glass-strong search-bar-shell relative flex items-center ${isCompact ? "compact" : ""}${multiline ? " is-multiline" : ""}`}
      >
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
        <textarea
          ref={inputRef}
          rows={1}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={onInputKeyDown}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
            if (!isCompact) setPulseKey((k) => k + 1);
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
          }}
          placeholder={placeholder}
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          className="search-bar-input relative flex-1 px-3"
        />
        {/* Discoverability hint for the non-obvious affordance: once the
            draft is multi-line, spell out the Enter/Shift+Enter contract. */}
        {multiline && !isCompact && (
          <span className="sb-mlhint" aria-hidden>
            <kbd>↵</kbd> search · <kbd>⇧↵</kbd> new line
          </span>
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            className={`relative flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors ${isCompact ? "w-11 h-11 sm:w-7 sm:h-7" : "w-11 h-11 sm:w-8 sm:h-8"} rounded-full`}
            aria-label="Clear search"
          >
            <X className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden />
          </button>
        )}

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

      {/* Autocomplete dropdown — glassy, keyboard-navigable. */}
      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            id={listboxId}
            role="listbox"
            aria-label="Search suggestions"
            className={`ts-suggest${isCompact ? " ts-suggest-compact" : ""}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}-${s.text}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`ts-suggest-item${i === activeIndex ? " is-active" : ""}`}
                // mousedown (not click) so it fires before the input's blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  runSearch(s.text);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="ts-suggest-icon" aria-hidden>
                  {s.kind === "recent" ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="ts-suggest-text">{s.text}</span>
                {s.kind === "recent" && <span className="ts-suggest-tag">recent</span>}
                <ArrowUpRight className="ts-suggest-go w-3.5 h-3.5" aria-hidden />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </form>
  );
}
