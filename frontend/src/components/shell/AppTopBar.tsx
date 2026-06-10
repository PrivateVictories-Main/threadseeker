"use client";

// Iter-23 / Major Overhaul I — persistent top bar.
//
// 56px tall glass-strong bar that sits above the main content (right of
// the sidebar). Hosts the always-on SearchBar (left), a compact status
// readout / count (center), and chrome on the right (⌘K hint, mobile
// hamburger). The bar replaces the previous sticky-header-on-results
// pattern — it's now persistent across landing AND results, so the
// search affordance never disappears.
//
// Right-side chrome is intentionally minimal here: sort + bookmark links
// live in the results sub-toolbar (ResultsToolbar) so the topbar stays
// uncluttered on the landing page where there's nothing to sort.

import { motion } from "framer-motion";
import { Menu, X as XIcon } from "lucide-react";
import { CountUp } from "@/components/motion/CountUp";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { COMMAND_PALETTE_OPEN_EVENT } from "@/components/command-palette-event";

interface Props {
  query: string;
  isLoading: boolean;
  onSearch: (q: string) => void;
  onDebouncedChange: (v: string) => void;
  /** Visible-results count, animated. Hidden on landing (resultCount===0). */
  resultCount: number;
  /** Total queried-source count for the in-flight search (used for the
   *  loading micro-readout: "loading 3 of 28"). */
  totalQueriedCount?: number;
  /** Sources currently still pending (during a live search). */
  pendingCount: number;
  /** End-to-end search duration. */
  durationMs: number | null;
  /** Mobile drawer toggle — sm and below shows hamburger. */
  mobileNavOpen: boolean;
  onMobileNavToggle: () => void;
  /** Currently in results mode (vs landing) — drives the count visibility. */
  inResultsMode: boolean;
  /** Iter-24 — active category label echoed in the status readout so
   *  the user always knows what slice they're viewing. */
  activeCategoryLabel?: string;
  onClear: () => void;
}

export function AppTopBar({
  query,
  isLoading,
  onSearch,
  onDebouncedChange,
  resultCount,
  totalQueriedCount,
  pendingCount,
  durationMs,
  mobileNavOpen,
  onMobileNavToggle,
  inResultsMode,
  activeCategoryLabel,
  onClear,
}: Props) {
  return (
    <motion.header
      className="ts-topbar glass-strong"
      aria-label="ThreadSeeker search"
      // Iter-24 — fade down from above on mount. 0.3s, springSoft cadence.
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 26, mass: 0.8 }}
    >
      <div className="ts-topbar-inner">
        {/* Mobile hamburger — only visible <md (sidebar hides below md
            so we surface the rail trigger here). The hamburger doesn't
            currently open a real drawer; it's a toggle indicator that
            the parent AppShell uses to show/hide the sidebar overlay. */}
        <button
          type="button"
          onClick={onMobileNavToggle}
          className="ts-topbar-hamburger md:hidden"
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
          aria-controls="ts-app-sidebar"
        >
          {mobileNavOpen ? (
            <XIcon className="w-4 h-4" aria-hidden />
          ) : (
            <Menu className="w-4 h-4" aria-hidden />
          )}
        </button>

        {/* SEARCH — always present, compact size. Takes most of the
            available row width on phones; capped on desktop so the
            stats cluster has room. */}
        <div className="ts-topbar-search">
          <SearchBar
            onSearch={onSearch}
            isLoading={isLoading}
            size="compact"
            initialValue={query}
            onDebouncedChange={onDebouncedChange}
          />
        </div>

        {/* CENTER — live status readout. Hidden on landing because
            "0 results · 0ms" reads as broken; only present in results
            mode where there's something to count. Iter-24 — surfaces
            the active category label and a finer "loading X of N"
            readout with thinking dots. */}
        {inResultsMode && (
          <div className="ts-topbar-status" aria-hidden>
            {activeCategoryLabel && (
              <>
                <span className="text-[var(--ts-accent-strong)] font-semibold normal-case tracking-tight">
                  {activeCategoryLabel}
                </span>
                <span className="ts-topbar-sep">·</span>
              </>
            )}
            <span className="ts-topbar-count">
              <CountUp value={resultCount} />
            </span>
            <span className="ts-topbar-status-label">results</span>
            {isLoading && pendingCount > 0 && (
              <>
                <span className="ts-topbar-sep">·</span>
                <span className="ts-topbar-loading">
                  <span className="ts-topbar-thinking" aria-hidden>
                    <span className="ts-topbar-thinking-dot" />
                    <span className="ts-topbar-thinking-dot" />
                    <span className="ts-topbar-thinking-dot" />
                  </span>
                  {typeof totalQueriedCount === "number" && totalQueriedCount > 0 ? (
                    <span>
                      loading <span className="tabular-nums">{Math.max(0, totalQueriedCount - pendingCount)}</span>{" "}
                      of <span className="tabular-nums">{totalQueriedCount}</span>
                    </span>
                  ) : (
                    <span>{pendingCount} loading</span>
                  )}
                </span>
              </>
            )}
            {!isLoading && durationMs !== null && (
              <>
                <span className="ts-topbar-sep">·</span>
                <span className="ts-topbar-time">
                  {durationMs < 1000
                    ? `${durationMs}ms`
                    : durationMs < 2000
                      ? `${(durationMs / 1000).toFixed(1)}s`
                      : `${Math.round(durationMs / 1000)}s`}
                </span>
              </>
            )}
          </div>
        )}

        {/* RIGHT — theme toggle + ⌘K hint chip + clear. */}
        <div className="ts-topbar-right">
          <ThemeToggle />
          <motion.button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
            }
            className="ts-topbar-cmdk hidden md:inline-flex"
            title="Open command palette (⌘K)"
            aria-label="Open command palette"
            whileTap={{ scale: 0.96 }}
          >
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </motion.button>
          {inResultsMode && (
            <button
              type="button"
              onClick={onClear}
              className="ts-topbar-clear"
              title="Clear search and return home"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
