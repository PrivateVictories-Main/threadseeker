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
  permissive: "text-emerald-700 bg-emerald-100/70 border-emerald-300",
  "weak-copyleft": "text-amber-700 bg-amber-100/70 border-amber-300",
  "strong-copyleft": "text-orange-700 bg-orange-100/70 border-orange-300",
  other: "text-slate-600 bg-slate-100 border-slate-300",
};

const MAINT_STYLES: Record<string, string> = {
  active: "text-emerald-700 bg-emerald-100/70 border-emerald-300",
  stale: "text-amber-700 bg-amber-100/70 border-amber-300",
  abandoned: "text-rose-700 bg-rose-100/70 border-rose-300",
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
          className="inline-flex items-center rounded border border-indigo-200 bg-white/80 px-1.5 py-[1px] font-mono text-slate-600"
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
