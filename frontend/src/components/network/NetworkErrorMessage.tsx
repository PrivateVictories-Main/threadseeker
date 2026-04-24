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

import { WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { getSourceConfig, SourceType } from "@/lib/sources";

interface NetworkErrorMessageProps {
  /** Number of sources queried in the failed run (for "All N were
   *  unreachable" copy). */
  sourceCount: number;
  onRetry: () => void;
  onClear: () => void;
}

export function NetworkErrorMessage({
  sourceCount,
  onRetry,
  onClear,
}: NetworkErrorMessageProps) {
  return (
    <div className="flex flex-col items-center text-center py-24">
      <div
        className="w-16 h-16 rounded-full glass-strong flex items-center justify-center mb-5"
        aria-hidden
      >
        <WifiOff className="w-7 h-7 text-indigo-400" />
      </div>
      <p className="text-lg font-semibold text-slate-800">
        Couldn&apos;t reach sources
      </p>
      <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-sm">
        All {sourceCount} sources were unreachable. This is usually a
        transient network hiccup &mdash; try again.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
        <button
          onClick={onRetry}
          className="btn btn-primary rounded-full h-11 px-6 text-[13px] inline-flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry search
        </button>
        <button
          onClick={onClear}
          className="text-[12.5px] font-medium text-slate-500 hover:text-indigo-700 transition-colors px-3.5 py-1.5"
        >
          Back to home
        </button>
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
        <div className="absolute left-0 top-full mt-1.5 z-20 glass-strong rounded-xl px-3 py-2.5 min-w-[200px] shadow-lg">
          <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-1.5">
            Didn&apos;t respond
          </p>
          <ul className="space-y-0.5">
            {failedSources.map((s) => {
              const cfg = getSourceConfig(s);
              const Icon = cfg.lucideIcon;
              return (
                <li
                  key={s}
                  className="flex items-center gap-1.5 text-[12px] text-slate-700"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500" aria-hidden />
                  <span>{cfg.name}</span>
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
