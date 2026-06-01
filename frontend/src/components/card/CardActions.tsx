"use client";

import { useState } from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";

export interface CopyItem {
  label: string;
  text: string;
}

export interface CardActionsProps {
  url: string;
  copyItems: CopyItem[];
  onCopy?: (text: string) => void;
  /**
   * Source-aware primary-action label. Defaults to "Open" — but thread
   * cards (HN/Reddit/Lobsters) and paper cards (arXiv/PWC/Zenodo) read
   * better with copy that names what the user is actually about to
   * visit. Caller passes the override; component just renders it.
   */
  openLabel?: string;
  /**
   * Iter-21 / Overhaul G — open the detail drawer (right-side slide-in
   * panel). Replaces the previous in-place expand toggle. When provided,
   * the action row gains a small mono "Details ↗" button that pops the
   * drawer; when omitted the row reads as before (no Details button).
   */
  onOpenDetails?: () => void;
}

export function CardActions({
  url,
  copyItems,
  onCopy,
  openLabel = "Open",
  onOpenDetails,
}: CardActionsProps) {
  // Per-button transient state: { label, ok }. Success fires onCopy (the
  // success toast); failure shows an inline warning and does NOT toast a
  // false "Copied" — the previous fire-and-forget always claimed success.
  const [status, setStatus] = useState<{ label: string; ok: boolean } | null>(null);

  const handleCopy = async (item: CopyItem) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(item.text);
      ok = true;
      onCopy?.(item.text);
    } catch {
      ok = false;
    }
    setStatus({ label: item.label, ok });
    window.setTimeout(
      () => setStatus((s) => (s?.label === item.label ? null : s)),
      1500,
    );
  };

  return (
    <div className="ts-actions">
      <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
        {openLabel} →
      </a>
      {copyItems.map((item) => {
        const active = status?.label === item.label;
        const ok = active && status?.ok;
        const failed = active && !status?.ok;
        return (
          <button
            key={item.label}
            type="button"
            className={`btn btn-ghost${ok ? " is-copied" : ""}${failed ? " is-copy-failed" : ""}`}
            onClick={() => handleCopy(item)}
            aria-live="polite"
          >
            {ok ? (
              <>
                <Check className="w-3 h-3" aria-hidden /> Copied
              </>
            ) : failed ? (
              <>
                <AlertTriangle className="w-3 h-3" aria-hidden /> Couldn&apos;t copy
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" aria-hidden /> {item.label}
              </>
            )}
          </button>
        );
      })}
      {onOpenDetails && (
        <button
          type="button"
          className="btn btn-ghost ts-details-btn"
          onClick={onOpenDetails}
          aria-label="Show details"
          title="Show full details"
        >
          Details ↗
        </button>
      )}
    </div>
  );
}
