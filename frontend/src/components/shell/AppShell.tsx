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

import { ReactNode, useState } from "react";
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
  durationMs: number | null;
  inResultsMode: boolean;
  onClear: () => void;
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
  durationMs,
  inResultsMode,
  onClear,
  children,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="ts-shell" data-mobile-nav={mobileNavOpen ? "open" : "closed"}>
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
          sidebar component can stay layout-pure. */}
      {mobileNavOpen && (
        <div
          className="ts-shell-mobile-backdrop md:hidden"
          aria-hidden
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="ts-shell-column">
        <AppTopBar
          query={query}
          isLoading={isLoading}
          onSearch={onSearch}
          onDebouncedChange={onDebouncedChange}
          resultCount={resultCount}
          pendingCount={pendingCount}
          durationMs={durationMs}
          mobileNavOpen={mobileNavOpen}
          onMobileNavToggle={() => setMobileNavOpen((v) => !v)}
          inResultsMode={inResultsMode}
          onClear={onClear}
        />
        <main id="main-content" className="ts-shell-main">
          {children}
        </main>
      </div>
    </div>
  );
}
