// At-a-glance metadata row. The goal of this row is that a developer can
// decide "should I use this?" without clicking into the project — they see
// the version, license type, and maintenance status at a glance.

import { UnifiedProject } from "@/lib/sources";

// License classification: permissive (green), weak-copyleft (amber),
// strong-copyleft (orange), proprietary/unknown (slate). Users picking a
// library for commercial work care about this before anything else.
function licenseBucket(license: string): {
  label: string;
  tone: "permissive" | "weak-copyleft" | "strong-copyleft" | "other";
} {
  const l = license.toLowerCase();
  if (/\b(mit|bsd|isc|apache|unlicense|0bsd|mit-0|cc0)\b/.test(l))
    return { label: license, tone: "permissive" };
  if (/\b(mpl|lgpl|epl|cddl)\b/.test(l))
    return { label: license, tone: "weak-copyleft" };
  if (/\b(gpl|agpl)\b/.test(l))
    return { label: license, tone: "strong-copyleft" };
  return { label: license, tone: "other" };
}

function maintenanceBucket(updatedAt: string): {
  label: string;
  tone: "active" | "stale" | "abandoned";
} | null {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  if (Number.isNaN(ageDays)) return null;
  if (ageDays < 90) return { label: "active", tone: "active" };
  if (ageDays < 365 * 2) return { label: "stale", tone: "stale" };
  if (ageDays > 365 * 3) return { label: "abandoned", tone: "abandoned" };
  return null;
}

const LICENSE_STYLES: Record<string, string> = {
  permissive: "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20",
  "weak-copyleft": "text-amber-400/80 bg-amber-500/10 border-amber-500/20",
  "strong-copyleft": "text-orange-400/80 bg-orange-500/10 border-orange-500/20",
  other: "text-slate-400/80 bg-slate-500/10 border-slate-500/20",
};

const MAINT_STYLES: Record<string, string> = {
  active: "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20",
  stale: "text-amber-400/80 bg-amber-500/10 border-amber-500/20",
  abandoned: "text-rose-400/80 bg-rose-500/10 border-rose-500/20",
};

export function CardMeta({ project }: { project: UnifiedProject }) {
  const version = project.version?.trim();
  const lic = project.license?.trim() ? licenseBucket(project.license.trim()) : null;
  const maint = maintenanceBucket(project.updatedAt);

  // Nothing to show — don't render the row at all.
  if (!version && !lic && !maint) return null;

  return (
    <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap text-[10px]">
      {version && (
        <span
          className="inline-flex items-center rounded border border-slate-700/40 bg-slate-900/50 px-1.5 py-[1px] font-mono text-slate-400"
          title="Latest published version"
        >
          v{version.replace(/^v/, "")}
        </span>
      )}
      {lic && (
        <span
          className={`inline-flex items-center rounded-full border px-1.5 py-[1px] font-medium ${LICENSE_STYLES[lic.tone]}`}
          title={`${lic.tone.replace("-", " ")} license`}
        >
          {lic.label}
        </span>
      )}
      {maint && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] uppercase tracking-wide ${MAINT_STYLES[maint.tone]}`}
          title={`Last updated ${new Date(project.updatedAt).toLocaleDateString()}`}
        >
          <span className="w-1 h-1 rounded-full bg-current" />
          {maint.label}
        </span>
      )}
    </div>
  );
}
