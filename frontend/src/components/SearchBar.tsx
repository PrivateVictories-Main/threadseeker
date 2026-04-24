"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
}

export function SearchBar({
  onSearch,
  isLoading,
  onDebouncedChange,
  debounceMs = 350,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

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

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search open-source projects"
      className="relative max-w-2xl mx-auto"
    >
      <div ref={shellRef} className="glass-strong search-bar-shell flex items-center transition-colors">
        <div className="pl-1">
          <Search className="w-5 h-5 text-indigo-500/70" aria-hidden />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (!shellRef.current) return;
            shellRef.current.classList.add("pulse");
            setTimeout(() => shellRef.current?.classList.remove("pulse"), 600);
          }}
          placeholder="What are you looking for?  (press /)"
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
          className="search-bar-input flex-1 h-12 px-3"
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="flex items-center gap-2 h-10 px-5 mr-1 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
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
