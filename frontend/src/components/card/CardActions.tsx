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
   * Iter-20 / Overhaul F — expand-toggle wiring. When `onToggleExpand`
   * is provided, the action row gains a small chevron control on the
   * far right that flips the expanded state on the parent card. The
   * `expanded` flag drives the chevron orientation + aria-expanded.
   */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function CardActions({
  url,
  copyItems,
  onCopy,
  openLabel = "Open",
  expanded,
  onToggleExpand,
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
      {onToggleExpand && (
        <button
          type="button"
          className={`btn btn-ghost ts-expand-toggle${expanded ? " is-expanded" : ""}`}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse details" : "Show more details"}
          title={expanded ? "Collapse" : "Show more"}
        >
          <span className="ts-expand-toggle-text">{expanded ? "Less" : "More"}</span>
          <span className="ts-expand-toggle-chev" aria-hidden>
            ▾
          </span>
        </button>
      )}
    </div>
  );
}
