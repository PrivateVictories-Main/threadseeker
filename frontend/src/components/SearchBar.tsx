"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

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
      <div className="glass-strong search-bar-shell flex items-center transition-colors">
        <div className="pl-1">
          <Search className="w-4.5 h-4.5 text-slate-600" aria-hidden />
        </div>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?  (press /)"
          aria-label="Search query"
          autoComplete="off"
          spellCheck={false}
          className="search-bar-input flex-1 text-sm h-12 px-3"
        />
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="flex items-center gap-2 h-9 px-5 mr-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
