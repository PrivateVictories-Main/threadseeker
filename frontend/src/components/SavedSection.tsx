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
    <div className="glass section-container mt-8">
      <h2 className="section-title flex items-center justify-center gap-2">
        <BookmarkCheck className="w-3 h-3 text-rose-500" />
        Saved · {items.length}
      </h2>
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
        {items.slice(0, 6).map((b) => {
          const cfg = getSourceConfig(b.source);
          return (
            <div
              key={b.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 hover:border-indigo-400 hover:bg-white pl-3 pr-1.5 py-1.5 transition-colors"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-indigo-700"
                title={b.description ?? b.fullName}
              >
                <span className="text-[12px]">{cfg.icon}</span>
                <span className="max-w-[180px] truncate">{b.name}</span>
              </a>
              <button
                onClick={() => {
                  removeBookmark(b.id);
                  emitBookmarksChanged();
                }}
                className="p-0.5 text-slate-400 hover:text-rose-600 transition-colors"
                aria-label={`Remove ${b.name} from saved`}
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
