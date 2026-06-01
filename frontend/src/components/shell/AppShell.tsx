"use client";

// Iter-23 / Major Overhaul I — application shell.
//
// AppShell composes the persistent sidebar + top bar + a children slot.
// The page swaps its rendered content into the children slot (landing
// content feed vs results grid); the shell itself is identical across
// modes — that's the architectural point of the overhaul.
//
// Layout:
//   <div data-shell>
//     <AppSidebar />            // 260px persistent on lg+, hidden <md
//     <div column>
//       <AppTopBar />           // 56px sticky top
//       <main>{children}</main>
//     </div>
//   </div>
//
// Mobile (<md): the sidebar collapses out entirely and the top bar
// surfaces a hamburger trigger. The hamburger toggles a state owned at
// the shell level so a future iteration can render a drawer overlay
// without re-wiring the page.

import { ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppSidebar, type CategoryKey } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";

interface Props {
  /** Page-level state forwarded into the sidebar/topbar. */
  activeCategory: CategoryKey;
  onCategoryChange: (key: CategoryKey) => void;
  history: string[];
  onHistoryClick: (q: string) => void;
  onHistoryRemove: (q: string) => void;
  // Top bar
  query: string;
  isLoading: boolean;
  onSearch: (q: string) => void;
  onDebouncedChange: (v: string) => void;
  resultCount: number;
  pendingCount: number;
  /** Total sources queried this run — drives the topbar "loading X of N" readout. */
  totalQueriedCount?: number;
  durationMs: number | null;
  inResultsMode: boolean;
  /** Label of the active category, surfaced in the topbar breadcrumb. */
  activeCategoryLabel?: string;
  onClear: () => void;
  /**
   * Iter-24 — when the DetailDrawer is open AND the viewport is xl+,
   * the shell promotes the drawer to a sticky right-rail pane (instead
   * of a slide-over). Lower viewports continue to render the
   * AnimatePresence slide-over. This prop is the hook for that
   * structural change; the actual DOM swap happens through
   * data-drawer-pinned + the existing DetailDrawer mount in the page.
   */
  drawerPinned?: boolean;
  // Slot
  children: ReactNode;
}

export function AppShell({
  activeCategory,
  onCategoryChange,
  history,
  onHistoryClick,
  onHistoryRemove,
  query,
  isLoading,
  onSearch,
  onDebouncedChange,
  resultCount,
  pendingCount,
  totalQueriedCount,
  durationMs,
  inResultsMode,
  activeCategoryLabel,
  onClear,
  drawerPinned = false,
  children,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Iter-24 — track page scroll so the topbar can lift off the surface
  // (data-scrolled="1" → soft drop shadow + intensified backdrop blur).
  // Threshold of 8px so the change triggers as soon as the user starts
  // scrolling, but not on a 1-pixel jiggle from layout settle.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setScrolled(y > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="ts-shell"
      data-mobile-nav={mobileNavOpen ? "open" : "closed"}
      data-scrolled={scrolled ? "1" : "0"}
      data-drawer-pinned={drawerPinned ? "1" : "0"}
    >
      <AppSidebar
        activeCategory={activeCategory}
        onCategoryChange={(k) => {
          onCategoryChange(k);
          setMobileNavOpen(false);
        }}
        history={history}
        onHistoryClick={(q) => {
          onHistoryClick(q);
          setMobileNavOpen(false);
        }}
        onHistoryRemove={onHistoryRemove}
      />

      {/* Mobile-only backdrop that closes the sidebar when tapped. The
          backdrop is part of the shell rather than the sidebar so the
          sidebar component can stay layout-pure. Iter-24 — moved to
          framer AnimatePresence so the fade matches the DetailDrawer
          backdrop vocabulary. */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            key="mobile-backdrop"
            className="ts-shell-mobile-backdrop md:hidden"
            aria-hidden
            onClick={() => setMobileNavOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
          />
        )}
      </AnimatePresence>

      <div className="ts-shell-column">
        <AppTopBar
          query={query}
          isLoading={isLoading}
          onSearch={onSearch}
          onDebouncedChange={onDebouncedChange}
          resultCount={resultCount}
          pendingCount={pendingCount}
          totalQueriedCount={totalQueriedCount}
          durationMs={durationMs}
          mobileNavOpen={mobileNavOpen}
          onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
          inResultsMode={inResultsMode}
          activeCategoryLabel={activeCategoryLabel}
          onClear={onClear}
        />
        <main id="main-content" className="ts-shell-main">
          {children}
        </main>
      </div>
    </div>
  );
}
