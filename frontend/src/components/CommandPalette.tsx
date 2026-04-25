"use client";

// ⌘K / Ctrl+K command palette — Raycast-grade signature interaction.
//
// Renders a glass-strong modal with autofocused search input + grouped
// command list. Sections (in render order):
//   - Search       — execute the typed query
//   - Quick        — six curated preset queries
//   - Filters      — toggle source filter / reset filters
//   - Sort         — switch sort modes
//   - Bookmarks    — top 5 saved projects
//   - Actions      — show shortcuts, clear history, reset filters
//
// Keyboard contract: ↑/↓ to nav, Enter fires, Esc closes. Typing narrows
// visible commands by case-insensitive substring match across label +
// subtitle + section title (so "github" matches the "Filter to GitHub"
// command in the Filters section).
//
// Open via:
//   - ⌘K (mac) / Ctrl+K (other)
//   - Custom event `threadseeker:open-command-palette` (callable from
//     anywhere — mirrors the ShortcutHelpModal pattern)
//
// Honors reduced-motion via the global <MotionConfig reducedMotion="user">
// in MotionProvider — no branching needed here.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Zap,
  Filter,
  ArrowDownUp,
  Bookmark,
  Sparkles,
  Keyboard,
  X,
  RotateCcw,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { springSoft } from "@/lib/motion";
import { SHORTCUT_HELP_EVENT } from "@/components/ShortcutHelpModal";
import { getBookmarks, type StoredBookmark } from "@/lib/bookmarks";
import { getSourceConfig, type SourceType } from "@/lib/sources";
import type { SortMode } from "@/components/ResultsToolbar";

export const COMMAND_PALETTE_OPEN_EVENT = "threadseeker:open-command-palette";

const QUICK_QUERIES = [
  "mcp server",
  "react state management",
  "rust http client",
  "local llm runtime",
  "agentic framework",
  "vector database",
] as const;

interface Command {
  id: string;
  section: string;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  kbd?: string;
  onRun: () => void;
}

interface CommandPaletteProps {
  /** Fire a search with this query. */
  onSearch: (q: string) => void;
  /** Sort change. */
  onSortChange: (mode: SortMode) => void;
  /** Set the active source filter (null = all sources). */
  onSourceFilterChange: (source: SourceType | null) => void;
  /** Clear search history. */
  onClearHistory: () => void;
  /** Reset all selected sources to all-sources. */
  onResetSources: () => void;
  /** Currently-active source filter (drives Filters section labels). */
  activeSourceFilter: SourceType | null;
  /** Currently-selected sort mode. */
  sortMode: SortMode;
  /** Sources currently in the active selection set. Used to surface
   *  "Reset filters" only when a non-default selection is in effect. */
  selectedSourcesCount: number;
  /** Total count of available sources — for the reset-to-all label. */
  totalSourcesCount: number;
  /** Pending input value from the page so the palette pre-fills with
   *  what the user has already typed if they hit ⌘K mid-search. */
  initialQuery?: string;
}

export function CommandPalette({
  onSearch,
  onSortChange,
  onSourceFilterChange,
  onClearHistory,
  onResetSources,
  activeSourceFilter,
  sortMode,
  selectedSourcesCount,
  totalSourcesCount,
  initialQuery = "",
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [bookmarks, setBookmarks] = useState<StoredBookmark[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Open / close keyboard handlers. ⌘K / Ctrl+K toggles. Skipped only
  // when the global toggle should fire — text inputs (including the
  // app's main search) MUST honor ⌘K to switch into command mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey as EventListener);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey as EventListener);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    };
  }, [open]);

  // Reset state every time the palette opens — fresh filter, fresh
  // active index, latest bookmarks.
  useEffect(() => {
    if (!open) return;
    setFilter(initialQuery.trim());
    setActiveIdx(0);
    setBookmarks(getBookmarks().slice(0, 5));
    // Autofocus the input on next tick so the modal is in the DOM first.
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, initialQuery]);

  // Build the command list. Memoized on every state input so we recompute
  // exactly when the surfaces feeding it change.
  const allCommands = useMemo<Command[]>(() => {
    const commands: Command[] = [];
    const close = () => setOpen(false);

    // SECTION — Search
    const trimmed = filter.trim();
    if (trimmed) {
      commands.push({
        id: "search:run",
        section: "Search",
        label: `Search for "${trimmed}"`,
        subtitle: "Run across all enabled sources",
        icon: Search,
        kbd: "↵",
        onRun: () => {
          onSearch(trimmed);
          close();
        },
      });
    }

    // SECTION — Quick searches
    for (const q of QUICK_QUERIES) {
      commands.push({
        id: `quick:${q}`,
        section: "Quick searches",
        label: q,
        subtitle: "Curated preset",
        icon: Zap,
        onRun: () => {
          onSearch(q);
          close();
        },
      });
    }

    // SECTION — Filters
    // Top 6 sources users most often want to pin to. Picked by community
    // size + how often they actually contain the kind of project a
    // ThreadSeeker user is hunting for.
    const FILTER_TARGETS: SourceType[] = [
      "github",
      "huggingface",
      "npm",
      "pypi",
      "crates",
      "dockerhub",
    ];
    for (const src of FILTER_TARGETS) {
      const cfg = getSourceConfig(src);
      const Icon = cfg.lucideIcon;
      const isActive = activeSourceFilter === src;
      commands.push({
        id: `filter:${src}`,
        section: "Filters",
        label: isActive
          ? `Showing only ${cfg.name}`
          : `Filter to ${cfg.name}`,
        subtitle: isActive ? "Click to clear" : cfg.tagline,
        icon: Icon,
        onRun: () => {
          onSourceFilterChange(isActive ? null : src);
          close();
        },
      });
    }
    if (activeSourceFilter) {
      commands.push({
        id: "filter:reset",
        section: "Filters",
        label: "Clear source filter",
        subtitle: "Show results from every source",
        icon: X,
        onRun: () => {
          onSourceFilterChange(null);
          close();
        },
      });
    }

    // SECTION — Sort
    const SORTS: { value: SortMode; label: string; subtitle: string }[] = [
      { value: "relevance", label: "Sort by relevance", subtitle: "Default ranking" },
      { value: "stars", label: "Sort by most stars", subtitle: "Popularity first" },
      { value: "updated", label: "Sort by recently updated", subtitle: "Activity first" },
      { value: "downloads", label: "Sort by most downloads", subtitle: "Adoption first" },
    ];
    for (const s of SORTS) {
      const isActive = sortMode === s.value;
      if (isActive) continue; // hide the already-active sort to keep the list tight
      commands.push({
        id: `sort:${s.value}`,
        section: "Sort",
        label: s.label,
        subtitle: s.subtitle,
        icon: ArrowDownUp,
        onRun: () => {
          onSortChange(s.value);
          close();
        },
      });
    }

    // SECTION — Bookmarks
    for (const b of bookmarks) {
      const cfg = getSourceConfig(b.source);
      const Icon = cfg.lucideIcon;
      commands.push({
        id: `bookmark:${b.id}`,
        section: "Bookmarks",
        label: b.name,
        subtitle: b.fullName !== b.name ? b.fullName : cfg.name,
        icon: Icon,
        onRun: () => {
          window.open(b.url, "_blank", "noopener,noreferrer");
          close();
        },
      });
    }

    // SECTION — Actions
    commands.push({
      id: "action:shortcuts",
      section: "Actions",
      label: "Show keyboard shortcuts",
      subtitle: "All ⌘ and key bindings",
      icon: Keyboard,
      kbd: "?",
      onRun: () => {
        close();
        window.dispatchEvent(new CustomEvent(SHORTCUT_HELP_EVENT));
      },
    });
    commands.push({
      id: "action:clear-history",
      section: "Actions",
      label: "Clear search history",
      subtitle: "Remove recent queries from the landing page",
      icon: Trash2,
      onRun: () => {
        onClearHistory();
        close();
      },
    });
    if (selectedSourcesCount < totalSourcesCount) {
      commands.push({
        id: "action:reset-sources",
        section: "Actions",
        label: "Reset all source toggles",
        subtitle: `Re-enable all ${totalSourcesCount} sources`,
        icon: RotateCcw,
        onRun: () => {
          onResetSources();
          close();
        },
      });
    }

    return commands;
  }, [
    filter,
    onSearch,
    onSortChange,
    onSourceFilterChange,
    onClearHistory,
    onResetSources,
    activeSourceFilter,
    sortMode,
    selectedSourcesCount,
    totalSourcesCount,
    bookmarks,
  ]);

  // Fuzzy filter — case-insensitive substring across label + subtitle +
  // section title. A formal fuzzy library would handle out-of-order
  // chars (e.g. "ghub" → "GitHub") but the substring approach is fast
  // and predictable enough for the command set's vocabulary.
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allCommands;
    return allCommands.filter((c) => {
      const haystack = `${c.section} ${c.label} ${c.subtitle ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allCommands, filter]);

  // Group commands by section while preserving the section order in
  // which they were registered. Map iteration order is insertion order
  // in modern JS, so a single Map walk keeps the ordering stable.
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of visible) {
      const list = map.get(c.section);
      if (list) list.push(c);
      else map.set(c.section, [c]);
    }
    return Array.from(map.entries());
  }, [visible]);

  // Clamp activeIdx whenever the visible set shrinks.
  useEffect(() => {
    if (activeIdx >= visible.length && visible.length > 0) {
      setActiveIdx(0);
    }
  }, [visible, activeIdx]);

  // Scroll the active row into view as the user arrows through.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = visible[activeIdx];
      if (cmd) cmd.onRun();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-indigo-950/45 backdrop-blur-sm p-4 pt-[12vh]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-palette-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16, ease: [0.32, 0.72, 0, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.14, ease: [0.32, 0.72, 0, 1] } }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-2xl rounded-[18px] overflow-hidden flex flex-col shadow-2xl"
            style={{ maxHeight: "min(70vh, 560px)" }}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: springSoft }}
            exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14 } }}
          >
            <h2 id="command-palette-title" className="sr-only">
              Command palette
            </h2>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-100/80">
              <Search className="w-4 h-4 text-indigo-400 flex-shrink-0" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search commands or type a query…"
                aria-label="Search commands"
                className="flex-1 bg-transparent border-0 outline-none text-[14px] text-slate-800 placeholder:text-slate-400"
              />
              <kbd className="hidden sm:inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded border border-indigo-200 bg-white/80 font-mono text-[10.5px] text-slate-500">
                ESC
              </kbd>
            </div>

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-2 py-2"
              role="listbox"
              aria-label="Available commands"
            >
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Sparkles className="w-5 h-5 text-indigo-300 mb-2" aria-hidden />
                  <p className="text-[13px] text-slate-500">No matching commands.</p>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">
                    Press{" "}
                    <kbd className="px-1 py-0.5 rounded border border-indigo-200 bg-white font-mono text-[10px]">
                      ↵
                    </kbd>{" "}
                    to search anyway.
                  </p>
                </div>
              ) : (
                grouped.map(([section, items], gIdx) => {
                  const startIdx = grouped
                    .slice(0, gIdx)
                    .reduce((sum, [, list]) => sum + list.length, 0);
                  return (
                    <div key={section} className="py-1">
                      <div className="px-3 pt-2 pb-1.5">
                        <span className="ts-section-header">
                          {`// ${section}`}
                        </span>
                      </div>
                      {items.map((cmd, iIdx) => {
                        const idx = startIdx + iIdx;
                        const isActive = idx === activeIdx;
                        const Icon = cmd.icon;
                        return (
                          <button
                            key={cmd.id}
                            type="button"
                            data-cmd-idx={idx}
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => cmd.onRun()}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                              isActive
                                ? "bg-indigo-50/90 text-slate-900"
                                : "hover:bg-white/60 text-slate-700"
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 transition-colors ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-white/70 text-slate-500 border border-indigo-100"
                              }`}
                              aria-hidden
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col">
                              <span className="text-[13px] font-medium truncate">
                                {cmd.label}
                              </span>
                              {cmd.subtitle && (
                                <span className="text-[11.5px] text-slate-500 truncate">
                                  {cmd.subtitle}
                                </span>
                              )}
                            </span>
                            {cmd.kbd && (
                              <kbd className="hidden sm:inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded border border-indigo-200 bg-white/90 font-mono text-[10.5px] text-slate-500 flex-shrink-0">
                                {cmd.kbd}
                              </kbd>
                            )}
                            {isActive && !cmd.kbd && (
                              <ArrowRight
                                className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
                                aria-hidden
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-indigo-100/80 font-mono text-[10.5px] uppercase tracking-[0.08em] text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-indigo-200 bg-white/80 text-[10px] text-slate-600 normal-case tracking-normal">
                    ↑↓
                  </kbd>
                  navigate
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-indigo-200 bg-white/80 text-[10px] text-slate-600 normal-case tracking-normal">
                    ↵
                  </kbd>
                  run
                </span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <Filter className="w-3 h-3" aria-hidden />
                <span className="tabular-nums">{visible.length}</span>
                <span>commands</span>
              </span>
              <span className="sm:hidden inline-flex items-center gap-1">
                <Bookmark className="w-3 h-3" aria-hidden />
                {bookmarks.length}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
