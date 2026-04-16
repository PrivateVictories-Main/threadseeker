"use client";

import { useState, FormEvent } from "react";
import { Search, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
      <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-800/60 focus-within:border-slate-600/60 transition-colors">
        <div className="pl-4">
          <Search className="w-4.5 h-4.5 text-slate-600" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?"
          className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-600 text-sm h-12 px-3 focus:outline-none"
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
