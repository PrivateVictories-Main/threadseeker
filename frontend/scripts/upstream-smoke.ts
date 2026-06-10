// Upstream drift smoke — hits a representative set of the LIVE, keyless
// upstream search APIs ThreadSeeker depends on (query: "json") and asserts
// each returns HTTP 200 with a non-empty parse. Run weekly from CI (and on
// demand): `npx tsx scripts/upstream-smoke.ts`.
//
// This is intentionally a HARD gate — a red run means a real upstream search
// API died or changed shape, which is exactly what the weekly job exists to
// catch. Per-source timeout is short (8s) so the whole sweep stays fast.

const QUERY = "json";
const TIMEOUT_MS = 8_000;
const USER_AGENT =
  "ThreadSeeker-upstream-smoke/1.0 (+https://github.com/PrivateVictories-Main/threadseeker)";

const asArray = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const asObject = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" ? (x as Record<string, unknown>) : {};

interface SourceCheck {
  /** Source name as shown in the table (matches the adapter it represents). */
  name: string;
  url: string;
  /** Number of parsed result items — 0 (or a throw) fails the source. */
  count: (data: unknown) => number;
}

// Mirrors the endpoints src/lib/sources/adapters.ts actually calls, minus the
// ones that need keys or a server-side proxy. PyPI has no public search API
// (the adapter does per-package JSON lookups), so probe the lookup endpoint
// with a package matching the query instead.
const CHECKS: SourceCheck[] = [
  {
    name: "github",
    url: `https://api.github.com/search/repositories?q=${QUERY}&per_page=5`,
    count: (d) => asArray(asObject(d).items).length,
  },
  {
    name: "npm",
    url: `https://registry.npmjs.org/-/v1/search?text=${QUERY}&size=5`,
    count: (d) => asArray(asObject(d).objects).length,
  },
  {
    name: "pypi",
    url: "https://pypi.org/pypi/json5/json",
    count: (d) => (asObject(asObject(d).info).name ? 1 : 0),
  },
  {
    name: "crates.io",
    url: `https://crates.io/api/v1/crates?q=${QUERY}&per_page=5`,
    count: (d) => asArray(asObject(d).crates).length,
  },
  {
    name: "hex.pm",
    url: `https://hex.pm/api/packages?search=${QUERY}&sort=recent_downloads`,
    count: (d) => asArray(d).length,
  },
  {
    name: "pub.dev",
    url: `https://pub.dev/api/search?q=${QUERY}`,
    count: (d) => asArray(asObject(d).packages).length,
  },
  {
    name: "packagist",
    url: `https://packagist.org/search.json?q=${QUERY}&per_page=5`,
    count: (d) => asArray(asObject(d).results).length,
  },
  {
    name: "rubygems",
    url: `https://rubygems.org/api/v1/search.json?query=${QUERY}`,
    count: (d) => asArray(d).length,
  },
  {
    name: "nuget",
    url: `https://azuresearch-usnc.nuget.org/query?q=${QUERY}&take=5&prerelease=false`,
    count: (d) => asArray(asObject(d).data).length,
  },
  {
    name: "gitlab",
    url: `https://gitlab.com/api/v4/projects?search=${QUERY}&per_page=5`,
    count: (d) => asArray(d).length,
  },
  {
    name: "huggingface",
    url: `https://huggingface.co/api/models?search=${QUERY}&limit=5`,
    count: (d) => asArray(d).length,
  },
  {
    name: "hn-algolia",
    url: `https://hn.algolia.com/api/v1/search?query=${QUERY}&tags=story&hitsPerPage=5`,
    count: (d) => asArray(asObject(d).hits).length,
  },
];

interface CheckResult {
  name: string;
  ok: boolean;
  status: string;
  items: number;
  ms: number;
  note: string;
}

async function probe(check: SourceCheck): Promise<CheckResult> {
  const started = Date.now();
  try {
    const res = await fetch(check.url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    if (res.status !== 200) {
      return { name: check.name, ok: false, status: String(res.status), items: 0, ms, note: "non-200" };
    }
    const data: unknown = await res.json();
    const items = check.count(data);
    if (items < 1) {
      return { name: check.name, ok: false, status: "200", items, ms, note: "empty parse" };
    }
    return { name: check.name, ok: true, status: "200", items, ms, note: "" };
  } catch (e) {
    const ms = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    const note = /abort|timeout/i.test(msg) ? `timeout >${TIMEOUT_MS}ms` : msg.slice(0, 60);
    return { name: check.name, ok: false, status: "ERR", items: 0, ms, note };
  }
}

async function main(): Promise<void> {
  console.log(`Upstream drift smoke — query "${QUERY}", ${CHECKS.length} sources, ${TIMEOUT_MS}ms/source\n`);
  const results = await Promise.all(CHECKS.map(probe));

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `${pad("SOURCE", 14)}${pad("STATUS", 8)}${pad("ITEMS", 7)}${pad("MS", 7)}${pad("RESULT", 8)}NOTE`,
  );
  console.log("-".repeat(60));
  for (const r of results) {
    console.log(
      `${pad(r.name, 14)}${pad(r.status, 8)}${pad(String(r.items), 7)}${pad(String(r.ms), 7)}${pad(r.ok ? "OK" : "FAIL", 8)}${r.note}`,
    );
  }

  const failures = results.filter((r) => !r.ok);
  console.log("-".repeat(60));
  if (failures.length > 0) {
    console.error(
      `\n${failures.length}/${results.length} upstream source(s) FAILED: ${failures.map((f) => f.name).join(", ")}`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${results.length} upstream sources healthy.`);
}

main().catch((e) => {
  console.error("upstream-smoke crashed:", e);
  process.exit(1);
});
