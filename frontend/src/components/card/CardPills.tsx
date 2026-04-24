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

export function CardPills({ popularity, language, license, maintenance }: CardPillsProps) {
  return (
    <div className="ts-pills">
      <span className="pill pill-popularity">{popularity ?? "—"}</span>
      <span className="pill pill-language">{language ?? "—"}</span>
      <span className="pill pill-license">{license ?? "—"}</span>
      <span className={`pill pill-maint pill-maint-${maintenance}`}>{MAINT_LABEL[maintenance]}</span>
    </div>
  );
}
