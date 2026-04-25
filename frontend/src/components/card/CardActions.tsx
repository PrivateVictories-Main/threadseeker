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
  return (
    <div className="ts-actions">
      <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
        {openLabel} →
      </a>
      {copyItems.map((item) => (
        <button
          key={item.label}
          className="btn btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(item.text);
            onCopy?.(item.text);
          }}
        >
          ⎘ {item.label}
        </button>
      ))}
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
