"use client";

// Landing-page strip showing the user's saved projects, pulled from
// localStorage. Hidden entirely when there's nothing saved so the landing
// stays clean for first-time visitors.

import { useEffect, useState } from "react";
import {
  getBookmarks,
  onBookmarksChanged,
  removeBookmark,
  emitBookmarksChanged,
  type StoredBookmark,
} from "@/lib/bookmarks";
import { getSourceConfig } from "@/lib/sources";
import { BookmarkCheck, X } from "lucide-react";

export function SavedSection() {
  const [items, setItems] = useState<StoredBookmark[]>([]);

  useEffect(() => {
    setItems(getBookmarks());
    return onBookmarksChanged(() => setItems(getBookmarks()));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-wide text-slate-600">
        <BookmarkCheck className="w-3 h-3 text-amber-400/70" />
        Saved · {items.length}
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
        {items.slice(0, 12).map((b) => {
          const cfg = getSourceConfig(b.source);
          return (
            <div
              key={b.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-slate-800/60 bg-slate-900/50 hover:border-slate-700/70 pl-2 pr-1 py-1 transition-colors"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100"
                title={b.description ?? b.fullName}
              >
                <span className="text-[11px]">{cfg.icon}</span>
                <span className="max-w-[180px] truncate">{b.name}</span>
              </a>
              <button
                onClick={() => {
                  removeBookmark(b.id);
                  emitBookmarksChanged();
                }}
                className="p-0.5 text-slate-600 hover:text-slate-300 transition-colors"
                aria-label={`Remove ${b.name} from saved`}
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
