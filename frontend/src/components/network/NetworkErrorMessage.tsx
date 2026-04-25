"use client";

// Shared error-state vocabulary for source-fetch failures. Two surfaces,
// one component family:
//   - <NetworkErrorMessage>  — full-page card when *every* queried source
//     failed and no results landed. Used in place of the empty state so a
//     transient network blip reads as recoverable rather than terminal.
//   - <NetworkErrorTray>      — quiet ghost pill + dropdown for the
//     partial-failure case where some sources delivered. Lives inline in
//     the toolbar count line; expandable to list the failed sources.
//
// Extracted from page.tsx so both call sites share a single visual
// vocabulary (WifiOff / AlertTriangle / RefreshCw, indigo + amber tinting)
// instead of two parallel JSX blocks drifting apart over time.
//
// `<NetworkErrorMessage>` accepts overridable copy (icon, title,
// message, button labels) so it's reusable for non-search error states
// (e.g. "couldn't fetch bookmarks", "trending feed unavailable")
// without breaking the search call site, which keeps its existing
// sourceCount-based default.

import { WifiOff, RefreshCw, AlertTriangle, type LucideIcon } from "lucide-react";
import { getSourceConfig, SourceType } from "@/lib/sources";
import type { ReactNode } from "react";

interface NetworkErrorMessageProps {
  /** Number of sources queried in the failed run. Used to compose the
   *  default "All N sources were unreachable" message when no explicit
   *  `message` override is provided. Required for back-compat with the
   *  existing search call site. */
  sourceCount: number;
  onRetry: () => void;
  /** Optional secondary action — when omitted the secondary button
   *  doesn't render. The search page wires this to "Back to home". */
  onClear?: () => void;
  /** Override the error-pictogram. Defaults to WifiOff (network
   *  hiccup). Pass `AlertTriangle` etc. for non-network errors. */
  icon?: LucideIcon;
  /** Override the bold heading. Defaults to "Couldn't reach sources". */
  title?: ReactNode;
  /** Override the body copy. When omitted, falls back to a sourceCount-
   *  driven "All N sources were unreachable…" sentence. */
  message?: ReactNode;
  /** Primary button label. Defaults to "Retry search". */
  retryLabel?: ReactNode;
  /** Secondary button label. Defaults to "Back to home". */
  clearLabel?: ReactNode;
}

export function NetworkErrorMessage({
  sourceCount,
  onRetry,
  onClear,
  icon: Icon = WifiOff,
  title = "Couldn't reach sources",
  message,
  retryLabel = "Retry search",
  clearLabel = "Back to home",
}: NetworkErrorMessageProps) {
  const body = message ?? (
    <>
      All {sourceCount} sources were unreachable. This is usually a
      transient network hiccup &mdash; try again.
    </>
  );
  return (
    // Iter-17 mono parity sweep — the network-failure card now opens
    // with a "// NETWORK ERROR" mono section header so it reads in the
    // same typographic vocabulary as the rest of the page. Title bumps
    // from text-lg sans to a 20px tracking-tight headline that matches
    // the empty-state's anchor.
    <div className="flex flex-col items-center text-center py-24">
      <div
        className="w-16 h-16 rounded-full glass-strong flex items-center justify-center mb-5"
        aria-hidden
      >
        <Icon className="w-7 h-7 text-indigo-400" />
      </div>
      <span className="ts-section-header mb-1.5">{"// Network error"}</span>
      <p className="text-[20px] font-semibold text-slate-800 tracking-tight">
        {title}
      </p>
      <p className="text-[13.5px] text-slate-500 mt-2 max-w-sm leading-relaxed">
        {body}
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
        <button
          onClick={onRetry}
          className="btn btn-primary rounded-full h-11 px-6 text-[13px] inline-flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden />
          {retryLabel}
        </button>
        {onClear && (
          <button
            onClick={onClear}
            className="text-[12.5px] font-medium text-slate-500 hover:text-indigo-700 transition-colors px-3.5 py-1.5"
          >
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}

interface NetworkErrorTrayProps {
  failedSources: SourceType[];
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
}

export function NetworkErrorTray({
  failedSources,
  open,
  onToggle,
  onRetry,
}: NetworkErrorTrayProps) {
  if (failedSources.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-amber-700/90 hover:text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/70 hover:border-amber-300 rounded-full px-2.5 py-0.5 transition-colors"
        title="Some sources didn't respond. Click for details."
      >
        <AlertTriangle className="w-3 h-3" aria-hidden />
        <span className="tabular-nums">{failedSources.length}</span>
        <span>
          {failedSources.length === 1
            ? "source unavailable"
            : "sources unavailable"}
        </span>
      </button>
      {open && (
        // Placement at narrow viewports (≤320px iPhone-SE):
        // - `left-0` pins the left edge to the indicator, but combined
        //   with `min-w-[200px]` the tray could overflow the right edge
        //   when the indicator sits mid-row in a flex-wrap context.
        // - `max-w-[calc(100vw-32px)]` clamps the total width to the
        //   viewport minus a 16px margin on each side, so the tray
        //   never punches out of the viewport regardless of trigger
        //   position. Long source names ellipsize via `truncate` on
        //   the inner `<span>` rather than wrapping unpredictably.
        // - `min-w-0` on the wrapper lets flex/grid parents actually
        //   shrink children below their natural width.
        // - On `sm:+` we drop the clamp and restore the original
        //   200px floor since narrow-viewport pressure is gone.
        <div className="absolute left-0 top-full mt-1.5 z-20 glass-strong rounded-xl px-3 py-2.5 min-w-0 max-w-[calc(100vw-32px)] sm:min-w-[200px] sm:max-w-none shadow-lg">
          <p className="ts-section-header mb-1.5">
            {"// Didn't respond"}
          </p>
          <ul className="space-y-0.5">
            {failedSources.map((s) => {
              const cfg = getSourceConfig(s);
              const Icon = cfg.lucideIcon;
              return (
                <li
                  key={s}
                  className="flex items-center gap-1.5 text-[12px] text-slate-700 min-w-0"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
                  <span className="truncate">{cfg.name}</span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry search
          </button>
        </div>
      )}
    </div>
  );
}
