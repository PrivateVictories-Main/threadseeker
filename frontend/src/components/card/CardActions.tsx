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
}

export function CardActions({ url, copyItems, onCopy, openLabel = "Open" }: CardActionsProps) {
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
    </div>
  );
}
