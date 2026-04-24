export type MaintenanceState = "active" | "stale" | "abandoned" | "recent" | "unknown";

export interface CardPillsProps {
  popularity: string | null;
  language: string | null;
  license: string | null;
  maintenance: MaintenanceState;
}

const MAINT_LABEL: Record<MaintenanceState, string> = {
  active: "● Active",
  stale: "● Stale",
  abandoned: "● Abandoned",
  recent: "● Recent",
  unknown: "● Unknown",
};

// Sparse-aware: pills with no real data are skipped entirely rather than
// rendered as "—" placeholders (previously a card missing every field
// showed four dashes — visual noise without information). Popularity +
// language + license + license-bucket-Unknown all collapse when empty.
// Maintenance-unknown also drops, so a card with no timestamp doesn't
// carry a grey "● Unknown" pill. When every pill is empty the row
// renders as an empty fragment and the card's auto-mt-auto pushes the
// action row up instead.
export function CardPills({ popularity, language, license, maintenance }: CardPillsProps) {
  const showLicense = license && license !== "Unknown";
  const showMaintenance = maintenance !== "unknown";
  const pills: React.ReactNode[] = [];
  if (popularity) {
    pills.push(
      <span key="pop" className="pill pill-popularity">
        {popularity}
      </span>,
    );
  }
  if (language) {
    pills.push(
      <span key="lang" className="pill pill-language">
        {language}
      </span>,
    );
  }
  if (showLicense) {
    pills.push(
      <span key="lic" className="pill pill-license">
        {license}
      </span>,
    );
  }
  if (showMaintenance) {
    pills.push(
      <span
        key="maint"
        className={`pill pill-maint pill-maint-${maintenance}`}
      >
        {MAINT_LABEL[maintenance]}
      </span>,
    );
  }
  if (pills.length === 0) return null;
  return <div className="ts-pills">{pills}</div>;
}
