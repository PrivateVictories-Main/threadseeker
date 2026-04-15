"use client";

import { useState, FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Wand2 } from "lucide-react";

interface EnhancedSearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const suggestions = [
  { text: "AI image generation", icon: "🎨" },
  { text: "React UI components", icon: "⚛️" },
  { text: "Python data science", icon: "📊" },
  { text: "Rust CLI tools", icon: "🦀" },
  { text: "Next.js templates", icon: "▲" },
  { text: "Machine learning models", icon: "🤖" },
  { text: "TypeScript utilities", icon: "📘" },
  { text: "Node.js APIs", icon: "🟢" },
];

export function EnhancedSearchBar({ onSearch, isLoading }: EnhancedSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="relative">
        {/* Search container */}
        <div className="relative bg-slate-900/40 rounded-lg border border-slate-800/50 focus-within:border-slate-700/50 transition-all duration-200">
          <div className="flex items-center gap-3">
            {/* Search icon */}
            <div className="pl-4">
              <Search className="w-4 h-4 text-slate-600" />
            </div>
            
            {/* Input */}
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Search projects..."
              className="flex-1 border-0 bg-transparent text-slate-200 placeholder:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-11 px-0"
            />
            
            {/* Search button */}
            <Button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="h-8 px-4 mr-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border-0 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-200 rounded-full animate-spin" />
                  <span>Searching</span>
                </div>
              ) : (
                <span>Search</span>
              )}
            </Button>
          </div>
        </div>

      </form>

      {/* Removed suggestion pills for cleaner look */}
    </div>
  );
}

