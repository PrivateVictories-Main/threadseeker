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

const SHELF_LIMIT = 8;

export function SavedSection() {
  const [items, setItems] = useState<StoredBookmark[]>([]);

  useEffect(() => {
    setItems(getBookmarks());
    return onBookmarksChanged(() => setItems(getBookmarks()));
  }, []);

  if (items.length === 0) return null;

  const shelf = items.slice(0, SHELF_LIMIT);
  const overflow = items.length - shelf.length;

  const clearAll = () => {
    // Remove all bookmarks by clearing the localStorage key via the API.
    for (const b of items) removeBookmark(b.id);
    emitBookmarksChanged();
  };

  return (
    <div className="glass section-container mt-12">
      <div className="relative flex items-center justify-center mb-3">
        <h2 className="section-title flex items-center gap-2 m-0">
          <BookmarkCheck className="w-3 h-3 text-rose-500" />
          Saved · {items.length}
        </h2>
        {/* Clear-all sits on the right, ghost-weight so it reads as an
            affordance only once you notice it. */}
        <button
          onClick={clearAll}
          className="absolute right-0 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
          aria-label="Remove all saved projects"
          title="Clear all saved"
        >
          Clear all
        </button>
      </div>

      {/* Library-shelf grid — 2 columns on phone so the shelf fills a row,
          up to 4 on desktop. Each tile is a dense glass card: source icon,
          project name, owner subline, and a hover-revealed remove button. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-w-3xl mx-auto">
        {shelf.map((b) => {
          const cfg = getSourceConfig(b.source);
          const Icon = cfg.lucideIcon;
          const owner = b.fullName.includes("/") ? b.fullName.split("/")[0] : "";
          return (
            <div
              key={b.id}
              className="group relative flex items-center gap-2 rounded-xl border border-indigo-100 bg-white/75 hover:bg-white hover:border-indigo-300 hover:shadow-sm px-2.5 py-2 transition-all"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-w-0 flex-1"
                title={b.description ?? b.fullName}
              >
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 flex-shrink-0"
                  aria-hidden
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12.5px] font-medium text-slate-800 group-hover:text-indigo-700 truncate">
                    {b.name}
                  </span>
                  {owner && (
                    <span className="text-[10.5px] text-slate-500 truncate">
                      {owner}
                    </span>
                  )}
                </span>
              </a>
              <button
                onClick={() => {
                  removeBookmark(b.id);
                  emitBookmarksChanged();
                }}
                className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0"
                aria-label={`Remove ${b.name} from saved`}
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {overflow > 0 && (
        <p className="text-center text-[11px] text-slate-400 mt-2.5">
          +{overflow} more saved
        </p>
      )}
    </div>
  );
}
