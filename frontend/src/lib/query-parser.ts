// Parse advanced search operators out of a user query so we can (a) strip
// them from the query passed to upstream APIs and (b) apply them as
// post-filters on the merged result set.
//
// Supported:
//   lang:rust            — filter by project.language (case-insensitive)
//   source:github        — restrict to a single source
//   stars:>1000          — stars gt N (also <, >=, <=, =)
//   stars:100..5000      — stars in an inclusive range
//   license:mit          — substring match against project.license
//   min-stars:500        — alias for stars:>=N
//
// Everything that doesn't match an operator pattern falls through as
// free-text search. Operators are space-separated; quoted phrases not yet
// supported (not needed for current API surfaces).

import type { SourceType, UnifiedProject } from "./sources";

export interface ParsedQuery {
  freeText: string;
  lang?: string;
  source?: SourceType;
  license?: string;
  stars?: { op: "gt" | "gte" | "lt" | "lte" | "eq" | "range"; value: number; upper?: number };
  raw: string;
}

const OPERATOR_RE = /^(lang|language|source|license|stars|min-stars|min_stars):(.+)$/i;

export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const free: string[] = [];
  const parsed: ParsedQuery = { freeText: "", raw };

  for (const tok of tokens) {
    const m = tok.match(OPERATOR_RE);
    if (!m) {
      free.push(tok);
      continue;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (!value) {
      free.push(tok);
      continue;
    }
    switch (key) {
      case "lang":
      case "language":
        parsed.lang = value.toLowerCase();
        break;
      case "source":
        parsed.source = value.toLowerCase() as SourceType;
        break;
      case "license":
        parsed.license = value.toLowerCase();
        break;
      case "stars": {
        const s = parseStarsExpr(value);
        if (s) parsed.stars = s;
        else free.push(tok);
        break;
      }
      case "min-stars":
      case "min_stars": {
        const n = Number(value);
        if (!Number.isNaN(n)) parsed.stars = { op: "gte", value: n };
        else free.push(tok);
        break;
      }
      default:
        free.push(tok);
    }
  }

  parsed.freeText = free.join(" ");
  return parsed;
}

function parseStarsExpr(s: string): ParsedQuery["stars"] | null {
  // Range: "100..5000"
  const range = s.match(/^(\d+)\.\.(\d+)$/);
  if (range) {
    return {
      op: "range",
      value: Number(range[1]),
      upper: Number(range[2]),
    };
  }
  // Comparators
  const m = s.match(/^(>=|<=|>|<|=)?(\d+)$/);
  if (!m) return null;
  const n = Number(m[2]);
  if (Number.isNaN(n)) return null;
  const opMap: Record<string, ParsedQuery["stars"] extends infer T ? (T extends { op: infer O } ? O : never) : never> = {
    ">": "gt",
    "<": "lt",
    ">=": "gte",
    "<=": "lte",
    "=": "eq",
    "": "gte", // bare number → gte
  };
  return { op: opMap[m[1] ?? ""] ?? "gte", value: n };
}

export function applyOperators(
  projects: UnifiedProject[],
  parsed: ParsedQuery,
): UnifiedProject[] {
  if (!parsed.lang && !parsed.source && !parsed.license && !parsed.stars) {
    return projects;
  }
  return projects.filter((p) => {
    if (parsed.source && p.source !== parsed.source) return false;
    if (parsed.lang) {
      const lang = (p.language || "").toLowerCase();
      if (!lang || lang !== parsed.lang) return false;
    }
    if (parsed.license) {
      const lic = (p.license || "").toLowerCase();
      if (!lic.includes(parsed.license)) return false;
    }
    if (parsed.stars) {
      const n = p.stars ?? 0;
      const { op, value, upper } = parsed.stars;
      if (op === "gt" && !(n > value)) return false;
      if (op === "gte" && !(n >= value)) return false;
      if (op === "lt" && !(n < value)) return false;
      if (op === "lte" && !(n <= value)) return false;
      if (op === "eq" && !(n === value)) return false;
      if (op === "range") {
        if (!(n >= value && n <= (upper ?? value))) return false;
      }
    }
    return true;
  });
}

// A short human-readable summary of the active operators, for display in
// the results header ("filtered by lang:rust, stars:>500").
export function describeOperators(parsed: ParsedQuery): string {
  const parts: string[] = [];
  if (parsed.lang) parts.push(`lang:${parsed.lang}`);
  if (parsed.source) parts.push(`source:${parsed.source}`);
  if (parsed.license) parts.push(`license:${parsed.license}`);
  if (parsed.stars) {
    const { op, value, upper } = parsed.stars;
    if (op === "range") parts.push(`stars:${value}..${upper}`);
    else {
      const sym = { gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "=" }[op];
      parts.push(`stars:${sym}${value}`);
    }
  }
  return parts.join(" ");
}
