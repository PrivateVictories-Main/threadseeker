export interface CopyItem {
  label: string;
  text: string;
}

export interface CardActionsProps {
  url: string;
  copyItems: CopyItem[];
  onCopy?: (text: string) => void;
}

export function CardActions({ url, copyItems, onCopy }: CardActionsProps) {
  return (
    <div className="ts-actions">
      <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
        Open →
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
