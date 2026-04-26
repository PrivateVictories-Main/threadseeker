"use client";

// Iter-23 / Major Overhaul I — persistent left sidebar.
//
// The headline architectural change of the overhaul: ThreadSeeker is no
// longer a centered single-column page. The application surface is now
// `[ Sidebar | Main ]`. The sidebar is 260px wide on lg+, collapses to
// an icon rail at md, and is fully replaced by a hamburger drawer
// trigger below md (the rail itself is hidden — the AppTopBar surfaces
// the trigger).
//
// Sections (top→bottom):
//   1. BrandMark — small wordmark anchored to the sidebar header.
//   2. // CATEGORIES — navigation pills (All / Repos / Packages / AI /
//      Papers / Threads). Active pill carries the indigo gradient fill
//      and a soft inner glow.
//   3. // RECENT — the user's last 6 searches from history. Click to
//      re-run; per-row × clears that single entry. Hidden when the
//      history list is empty.
//   4. // SAVED — the user's last 5 bookmarks from the bookmarks store.
//      Click opens the underlying URL in a new tab.
//   5. Footer — ⌘K hint, GitHub link, made-with-care line.
//
// Visual: glass-strong with right-edge 1px indigo-soft border, sticky
// position so it stays put on scroll. Spotify-macOS sidebar feel.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  GitBranch,
  Package,
  Cpu,
  FileText,
  MessageSquare,
  Clock,
  BookmarkCheck,
  Github,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import {
  COMMAND_PALETTE_OPEN_EVENT,
} from "@/components/CommandPalette";
import {
  getBookmarks,
  onBookmarksChanged,
  type StoredBookmark,
} from "@/lib/bookmarks";
import { getSourceConfig } from "@/lib/sources";

export type CategoryKey = "all" | "repos" | "packages" | "ai" | "papers" | "threads";

export interface SidebarCategory {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
}

export const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  { key: "all", label: "All sources", icon: Globe },
  { key: "repos", label: "Repositories", icon: GitBranch },
  { key: "packages", label: "Packages", icon: Package },
  { key: "ai", label: "AI Models", icon: Cpu },
  { key: "papers", label: "Papers", icon: FileText },
  { key: "threads", label: "Threads", icon: MessageSquare },
];

interface Props {
  /** Active category pill in the navigation block. */
  activeCategory: CategoryKey;
  onCategoryChange: (key: CategoryKey) => void;
  /** Recent search history (most-recent-first). Sliced to 6 rows. */
  history: string[];
  onHistoryClick: (query: string) => void;
  /** Remove one entry from history. */
  onHistoryRemove: (query: string) => void;
}

// localStorage event name used by `removeBookmark` etc. — see lib/bookmarks.
// Sidebar mirrors the SavedSection pattern for live updates.

export function AppSidebar({
  activeCategory,
  onCategoryChange,
  history,
  onHistoryClick,
  onHistoryRemove,
}: Props) {
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBookmarks(getBookmarks());
    return onBookmarksChanged(() => setBookmarks(getBookmarks()));
  }, []);

  const recent = history.slice(0, 6);
  const saved = bookmarks.slice(0, 5);

  return (
    <aside
      className="ts-sidebar glass-strong"
      aria-label="ThreadSeeker navigation"
    >
      <div className="ts-sidebar-inner">
        {/* HEADER — wordmark */}
        <div className="ts-sidebar-head">
          <BrandMark variant="hero" />
        </div>

        {/* CATEGORIES */}
        <nav className="ts-sidebar-section" aria-label="Filter by category">
          <h3 className="ts-sidebar-h">{"// CATEGORIES"}</h3>
          <ul className="ts-sidebar-list">
            {SIDEBAR_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const isActive = c.key === activeCategory;
              return (
                <li key={c.key}>
                  <motion.button
                    type="button"
                    onClick={() => onCategoryChange(c.key)}
                    className={`ts-sidebar-nav-item${isActive ? " is-active" : ""}`}
                    aria-pressed={isActive}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden />
                    <span className="ts-sidebar-nav-label">{c.label}</span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* RECENT */}
        {recent.length > 0 && (
          <section className="ts-sidebar-section" aria-label="Recent searches">
            <h3 className="ts-sidebar-h">
              <Clock className="w-3 h-3" aria-hidden />
              {"// RECENT"}
            </h3>
            <ul className="ts-sidebar-list">
              {recent.map((q) => (
                <li key={q} className="ts-sidebar-recent-row">
                  <button
                    type="button"
                    onClick={() => onHistoryClick(q)}
                    className="ts-sidebar-recent-btn"
                    title={`Search again: ${q}`}
                  >
                    <span className="ts-sidebar-recent-label">{q}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onHistoryRemove(q)}
                    className="ts-sidebar-recent-clear"
                    aria-label={`Remove ${q} from recent searches`}
                    title="Remove"
                  >
                    <X className="w-3 h-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* SAVED */}
        {saved.length > 0 && (
          <section className="ts-sidebar-section" aria-label="Saved projects">
            <h3 className="ts-sidebar-h">
              <BookmarkCheck className="w-3 h-3 text-rose-500" aria-hidden />
              {"// SAVED "}
              <strong>{bookmarks.length}</strong>
            </h3>
            <ul className="ts-sidebar-list">
              {saved.map((b) => {
                const cfg = getSourceConfig(b.source);
                const Icon = cfg.lucideIcon;
                return (
                  <li key={b.id}>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ts-sidebar-saved-row"
                      title={b.description ?? b.fullName}
                    >
                      <span className="ts-sidebar-saved-icon" aria-hidden>
                        <Icon className="w-3 h-3" />
                      </span>
                      <span className="ts-sidebar-saved-label">{b.name}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* SPACER pushes footer down */}
        <div className="ts-sidebar-spacer" />

        {/* FOOTER */}
        <footer className="ts-sidebar-footer">
          <button
            type="button"
            className="ts-sidebar-cmdk"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
            }
            title="Open command palette"
          >
            <span>Press</span>
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </button>
          <div className="ts-sidebar-foot-row">
            <a
              href="https://github.com/PrivateVictories-Main/threadseeker"
              target="_blank"
              rel="noopener noreferrer"
              className="ts-sidebar-foot-link"
              aria-label="ThreadSeeker on GitHub"
            >
              <Github className="w-3.5 h-3.5" aria-hidden />
              <span>GitHub</span>
            </a>
            <span className="ts-sidebar-care">made with care</span>
          </div>
        </footer>
      </div>
    </aside>
  );
}
