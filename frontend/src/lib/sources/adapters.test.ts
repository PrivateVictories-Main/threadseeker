// Golden-payload contract tests — one table row per source adapter.
//
// Three invariants, enforced for EVERY adapter via parameterized tables:
//
//   1. Happy path — given a realistic 2-item fixture (shapes spot-verified
//      against the live APIs, see __fixtures__/adapter-payloads.ts), the
//      adapter maps into well-formed UnifiedProjects: source-prefixed ids,
//      https urls, the right `source` tag, and non-negative numeric signals.
//   2. Never-throw degradation — a `{}` / `[]` envelope or items with
//      missing/null fields must resolve to an array, never reject. This is
//      the repo's core adapter contract (the orchestrator races all sources
//      and renders partials; one throwing adapter would zero its source).
//   3. HTTP failure — non-ok responses AND outright network rejections both
//      resolve to an empty result set.
//
// Mocking idiom follows src/lib/github.test.ts: vi.stubGlobal("fetch", …)
// with a URL-routing stub. Unrouted URLs default to 404 so multi-step
// adapters (pub.dev search→detail, GitHub proxy→direct) degrade rather than
// hang on an unexpected fetch. `unstubGlobals: true` in vitest.config.ts
// restores the real fetch after every test.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResult, SourceType } from "./types";
import {
  searchGitHub,
  searchGitLab,
  searchCodeberg,
  searchHuggingFace,
  searchPub,
  searchArxiv,
  searchNpm,
  searchPyPI,
  searchCrates,
  searchPackagist,
  searchRubyGems,
  searchJSR,
  searchDockerHub,
  searchFlathub,
  searchHomebrew,
  searchFDroid,
  searchAUR,
  searchOpenVsx,
  searchCondaForge,
  searchNuGet,
  searchZenodo,
  searchMaven,
  searchHex,
  searchWordPress,
  searchHackerNews,
  searchReddit,
  searchLobsters,
  searchStackOverflow,
  searchDevTo,
  searchModrinth,
  searchCRAN,
  searchAMO,
  searchGreasyFork,
  searchTerraform,
  searchSnapcraft,
  searchAnsibleGalaxy,
  searchGnomeExtensions,
  searchChocolatey,
  searchVcpkg,
  searchMelpa,
} from "./adapters";
import * as fx from "./__fixtures__/adapter-payloads";

type FetchMock = ReturnType<typeof vi.fn>;

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// URL-routing fetch stub. Routes are matched as substrings against BOTH the
// raw request URL and — for relay-style calls (/api/proxy?url=…, /api/gh?url=…)
// — the decoded upstream target, so each table row can declare routes against
// the real upstream URL regardless of transport. Unrouted URLs 404.
function routedFetch(routes: Record<string, unknown>): FetchMock {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(input);
    const encoded = raw.match(/[?&]url=([^&]+)/);
    const target = encoded ? decodeURIComponent(encoded[1]) : raw;
    for (const [fragment, payload] of Object.entries(routes)) {
      if (target.includes(fragment) || raw.includes(fragment)) {
        const value =
          typeof payload === "function" ? (payload as (i?: RequestInit) => unknown)(init) : payload;
        return value instanceof Response ? value : jsonRes(value);
      }
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

interface AdapterCase {
  /** Adapter under test, for it.each labels. */
  name: string;
  source: SourceType;
  /** Every UnifiedProject id must start with this. */
  idPrefix: string;
  /** Query whose tokens the fixtures satisfy (lobsters filters client-side). */
  query: string;
  run: (q: string, signal?: AbortSignal) => Promise<SearchResult>;
  /** URL fragment → happy-path payload. */
  routes: Record<string, unknown>;
  /** Builds this adapter's envelope around an arbitrary item list. */
  wrap: (items: unknown[]) => unknown;
  /** Exact happy-path project count (fixtures carry 2 mappable items). */
  expectCount: number;
  /** Optional source-specific assertions on the happy-path result. */
  extra?: (res: SearchResult, mock: FetchMock) => void;
}

const CASES: AdapterCase[] = [
  {
    name: "searchGitHub",
    source: "github",
    idPrefix: "github-",
    query: "react",
    // deepSearch=false → a single search strategy → deterministic one fetch.
    run: (q, s) => searchGitHub(q, 1, false, s),
    routes: { "api.github.com/search/repositories": fx.githubSearch },
    wrap: (items) => ({ items }),
    expectCount: 2,
    extra: (res) => {
      // Deleted-owner item must fall back to the org slug, not throw.
      const next = res.projects.find((p) => p.name === "next.js");
      expect(next?.author.name).toBe("vercel");
    },
  },
  {
    name: "searchGitLab",
    source: "gitlab",
    idPrefix: "gitlab-",
    query: "gitlab",
    run: (q, s) => searchGitLab(q, 1, true, s),
    routes: { "gitlab.com/api/v4/projects": fx.gitlabProjects },
    wrap: (items) => items,
    expectCount: 2,
  },
  {
    name: "searchCodeberg",
    source: "codeberg",
    idPrefix: "codeberg-",
    query: "forgejo",
    run: searchCodeberg,
    routes: { "codeberg.org/api/v1/repos/search": fx.codebergSearch },
    wrap: (items) => ({ data: items }),
    expectCount: 2,
  },
  {
    name: "searchHuggingFace",
    source: "huggingface",
    idPrefix: "hf-",
    query: "llama",
    // deepSearch=false → models endpoint only (datasets endpoint unrouted).
    run: (q, s) => searchHuggingFace(q, 1, false, s),
    routes: { "huggingface.co/api/models": fx.hfModels },
    wrap: (items) => items,
    expectCount: 2,
  },
  {
    name: "searchPub",
    source: "pub",
    idPrefix: "pub-",
    query: "http",
    run: searchPub,
    // Two-step adapter: name search, then per-package detail lookups.
    routes: {
      "pub.dev/api/search": fx.pubSearch,
      "pub.dev/api/packages/http": fx.pubDetailHttp,
      "pub.dev/api/packages/dio": fx.pubDetailDio,
    },
    wrap: (items) => ({ packages: items }),
    expectCount: 2,
  },
  {
    name: "searchArxiv",
    source: "arxiv",
    idPrefix: "arxiv-",
    query: "attention",
    run: searchArxiv,
    routes: { "/api/search-arxiv": fx.arxivBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchNpm",
    source: "npm",
    idPrefix: "npm-",
    query: "express",
    run: (q, s) => searchNpm(q, true, s),
    routes: { "registry.npmjs.org/-/v1/search": fx.npmSearch },
    wrap: (items) => ({ objects: items }),
    expectCount: 2,
    extra: (res) => {
      // npm has no stars — the honest popularity signal is score.detail.popularity.
      for (const p of res.projects) expect(p.stars).toBe(0);
      expect(res.projects[0].popularityScore).toBeCloseTo(0.91, 5);
    },
  },
  {
    name: "searchPyPI",
    source: "pypi",
    idPrefix: "pypi-",
    // Two significant tokens → two exact-name JSON lookups; the other
    // candidate spellings 404 through the stub's default and are dropped.
    query: "fastapi flask",
    run: (q, s) => searchPyPI(q, false, s),
    routes: {
      "pypi.org/pypi/fastapi/json": fx.pypiFastapi,
      "pypi.org/pypi/flask/json": fx.pypiFlask,
    },
    wrap: () => ({ info: {}, releases: {}, urls: [] }),
    expectCount: 2,
  },
  {
    name: "searchCrates",
    source: "crates",
    idPrefix: "crates-",
    query: "tokio",
    run: searchCrates,
    routes: { "crates.io/api/v1/crates": fx.cratesSearch },
    wrap: (items) => ({ crates: items }),
    expectCount: 2,
  },
  {
    name: "searchPackagist",
    source: "packagist",
    idPrefix: "packagist-",
    query: "monolog",
    run: searchPackagist,
    routes: { "packagist.org/search.json": fx.packagistSearch },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchRubyGems",
    source: "rubygems",
    idPrefix: "rubygems-",
    query: "rails",
    run: searchRubyGems,
    routes: { "rubygems.org/api/v1/search.json": fx.rubygemsSearch },
    wrap: (items) => items,
    expectCount: 2,
  },
  {
    name: "searchJSR",
    source: "jsr",
    idPrefix: "jsr-",
    query: "http",
    run: searchJSR,
    routes: { "api.jsr.io/packages": fx.jsrSearch },
    wrap: (items) => ({ items }),
    expectCount: 2,
    extra: (res) => {
      // 0-100 health score → normalized 0..1 popularity, never fake stars.
      expect(res.projects[0].stars).toBe(0);
      expect(res.projects[0].popularityScore).toBeCloseTo(0.94, 5);
    },
  },
  {
    name: "searchDockerHub",
    source: "dockerhub",
    idPrefix: "dockerhub-",
    query: "nginx",
    run: searchDockerHub,
    // Routed through the dedicated relay function (auth-capable), not the
    // generic proxy — hub.docker.com 429s Cloudflare's shared egress.
    routes: { "/api/search-dockerhub": fx.dockerhubSearch },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
    extra: (res) => {
      // Official (library) images live at /_/<name>; /r/_/<name> 400s.
      const official = res.projects.find((p) => p.fullName === "nginx");
      const namespaced = res.projects.find((p) => p.fullName === "bitnami/nginx");
      expect(official?.url).toBe("https://hub.docker.com/_/nginx");
      expect(namespaced?.url).toBe("https://hub.docker.com/r/bitnami/nginx");
    },
  },
  {
    name: "searchFlathub",
    source: "flathub",
    idPrefix: "flathub-",
    query: "vlc",
    run: searchFlathub,
    routes: { "flathub.org/api/v2/search": fx.flathubSearch },
    wrap: (items) => ({ hits: items }),
    expectCount: 2,
    extra: (res, mock) => {
      // Search is POST-only upstream — the adapter must relay method + body.
      const call = mock.mock.calls.find(([u]) => String(u).includes("flathub.org"));
      expect(call?.[1]?.method).toBe("POST");
      expect(String(call?.[1]?.body)).toContain('"query":"vlc"');
      // updated_at arrives as unix seconds → ISO string out.
      const vlc = res.projects.find((p) => p.name === "VLC");
      expect(vlc?.updatedAt).toBe(new Date(1748736000 * 1000).toISOString());
    },
  },
  {
    name: "searchHomebrew",
    source: "homebrew",
    idPrefix: "homebrew-",
    query: "wget",
    run: searchHomebrew,
    routes: { "/api/search-homebrew": fx.homebrewBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchFDroid",
    source: "fdroid",
    idPrefix: "fdroid-",
    query: "fdroid",
    run: searchFDroid,
    routes: { "/api/search-fdroid": fx.fdroidBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchAUR",
    source: "aur",
    idPrefix: "aur-",
    query: "yay",
    run: searchAUR,
    routes: { "aur.archlinux.org/rpc": fx.aurSearch },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchOpenVsx",
    source: "openvsx",
    idPrefix: "openvsx-",
    query: "java",
    run: searchOpenVsx,
    routes: { "open-vsx.org/api/-/search": fx.openvsxSearch },
    wrap: (items) => ({ extensions: items }),
    expectCount: 2,
  },
  {
    name: "searchCondaForge",
    source: "conda",
    idPrefix: "conda-",
    query: "numpy",
    run: searchCondaForge,
    routes: { "api.anaconda.org/search": fx.condaSearch },
    wrap: (items) => items,
    // Fixture carries 3 items; the non-preferred "anaconda" channel is dropped.
    expectCount: 2,
    extra: (res) => {
      expect(res.projects.map((p) => p.fullName)).not.toContain("anaconda/numpy");
    },
  },
  {
    name: "searchNuGet",
    source: "nuget",
    idPrefix: "nuget-",
    query: "json",
    run: searchNuGet,
    routes: { "azuresearch-usnc.nuget.org/query": fx.nugetSearch },
    wrap: (items) => ({ data: items }),
    expectCount: 2,
  },
  {
    name: "searchZenodo",
    source: "zenodo",
    idPrefix: "zenodo-",
    query: "scikit",
    run: searchZenodo,
    routes: { "zenodo.org/api/records": fx.zenodoSearch },
    wrap: (items) => ({ hits: { hits: items } }),
    expectCount: 2,
    extra: (res) => {
      // unique_views must NOT masquerade as stars (no-fake-stars policy):
      // it feeds the normalized popularity channel, clamped to [0,1].
      for (const p of res.projects) expect(p.stars).toBe(0);
      expect(res.projects[0].popularityScore).toBe(1); // 12k views, clamped
      expect(res.projects[1].popularityScore).toBeCloseTo(0.008, 5); // 80 views
    },
  },
  {
    name: "searchMaven",
    source: "maven",
    idPrefix: "maven-",
    query: "guava",
    run: searchMaven,
    routes: {
      // Inflate numFound to prove totalCount reports the docs in THIS page,
      // not Solr's corpus-wide match count.
      "search.maven.org/solrsearch": {
        ...fx.mavenSearch,
        response: { ...fx.mavenSearch.response, numFound: 184_000 },
      },
    },
    wrap: (items) => ({ response: { docs: items } }),
    expectCount: 2,
    extra: (res) => {
      expect(res.totalCount).toBe(2);
      // versionCount is release cadence, not popularity — never `downloads`.
      for (const p of res.projects) expect(p.downloads).toBeUndefined();
    },
  },
  {
    name: "searchHex",
    source: "hex",
    idPrefix: "hex-",
    query: "phoenix",
    run: searchHex,
    routes: { "hex.pm/api/packages": fx.hexSearch },
    wrap: (items) => items,
    expectCount: 2,
  },
  {
    name: "searchWordPress",
    source: "wordpress",
    idPrefix: "wordpress-",
    query: "cache",
    run: searchWordPress,
    routes: { "api.wordpress.org/plugins": fx.wordpressSearch },
    wrap: (items) => ({ plugins: items }),
    expectCount: 2,
    extra: (res) => {
      // 24h-clock variant parses; null last_updated maps to "" (not a throw,
      // not a fake "just now").
      expect(res.projects[0].updatedAt).toBe("2026-04-01T16:54:00.000Z");
      expect(res.projects[1].updatedAt).toBe("");
    },
  },
  {
    name: "searchHackerNews",
    source: "hackernews",
    idPrefix: "hn-",
    query: "metasearch",
    run: searchHackerNews,
    routes: { "hn.algolia.com/api/v1/search": fx.hnSearch },
    wrap: (items) => ({ hits: items }),
    expectCount: 2,
    extra: (res) => {
      // Text post (no url) links to the HN item page.
      expect(res.projects[1].url).toBe("https://news.ycombinator.com/item?id=39000002");
    },
  },
  {
    name: "searchReddit",
    source: "reddit",
    idPrefix: "reddit-",
    query: "rust framework",
    run: searchReddit,
    routes: { "/api/search-reddit": fx.redditBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
  },
  {
    name: "searchLobsters",
    source: "lobsters",
    idPrefix: "lobsters-",
    query: "rust",
    run: searchLobsters,
    routes: { "lobste.rs/hottest.json": fx.lobstersHottest },
    wrap: (items) => items,
    // 3-story feed, 2 match "rust" (title + tag); the PostgreSQL story drops.
    expectCount: 2,
    extra: (res) => {
      expect(res.projects.map((p) => p.name)).not.toContain("PostgreSQL vacuum internals");
      // submitter_user arrives as a string (current) or object (legacy).
      expect(res.projects[0].author.name).toBe("alice");
      expect(res.projects[1].author.name).toBe("bob");
    },
  },
  {
    name: "searchStackOverflow",
    source: "stackoverflow",
    idPrefix: "stackoverflow-",
    query: "sorted array",
    run: searchStackOverflow,
    routes: { "api.stackexchange.com/2.3/search": fx.stackoverflowSearch },
    wrap: (items) => ({ items }),
    expectCount: 2,
    extra: (res) => {
      // HTML entities in titles are decoded for display.
      expect(res.projects[1].name).toBe('What does the "yield" keyword do in Python?');
    },
  },
  {
    name: "searchDevTo",
    source: "devto",
    idPrefix: "devto-",
    query: "rust",
    run: searchDevTo,
    routes: { "dev.to/api/articles": fx.devtoSearch },
    wrap: (items) => items,
    expectCount: 2,
  },
  {
    name: "searchModrinth",
    source: "modrinth",
    idPrefix: "modrinth-",
    query: "sodium",
    run: searchModrinth,
    routes: { "api.modrinth.com/v2/search": fx.modrinthSearch },
    wrap: (items) => ({ hits: items }),
    expectCount: 2,
    extra: (res) => {
      // Listing URL is built from project_type + slug.
      expect(res.projects[0].url).toBe("https://modrinth.com/mod/sodium");
      // No stars on Modrinth — downloads is the honest signal.
      for (const p of res.projects) expect(p.stars).toBe(0);
      expect(res.projects[0].downloads).toBe(38_000_000);
    },
  },
  {
    name: "searchCRAN",
    source: "cran",
    idPrefix: "cran-",
    query: "ggplot",
    run: searchCRAN,
    routes: { "search.r-pkg.org/package/_search": fx.cranSearch },
    wrap: (items) => ({ hits: { hits: items } }),
    expectCount: 2,
    extra: (res) => {
      // Canonical CRAN listing URL + first homepage from the comma list.
      expect(res.projects[0].url).toBe("https://cran.r-project.org/package=ggplot2");
      expect(res.projects[0].homepage).toBe("https://ggplot2.tidyverse.org");
      // Missing _source.URL → no homepage, not a throw.
      expect(res.projects[1].homepage).toBeUndefined();
      // Monthly downloads mapped honestly.
      expect(res.projects[0].downloads).toBe(2_400_000);
    },
  },
  {
    name: "searchAMO",
    source: "amo",
    idPrefix: "amo-",
    query: "ublock",
    run: searchAMO,
    routes: { "addons.mozilla.org/api/v5/addons/search": fx.amoSearch },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
    extra: (res) => {
      // Locale-object fields ({en-US: …}) AND plain strings both unwrap.
      expect(res.projects[0].name).toBe("uBlock Origin");
      expect(res.projects[1].name).toBe("Tree Style Tab");
      // SPDX slug preferred over the localized license display name.
      expect(res.projects[0].license).toBe("GPL-3.0-only");
      // ADU is adoption, never a star count.
      for (const p of res.projects) expect(p.stars).toBe(0);
    },
  },
  {
    name: "searchGreasyFork",
    source: "greasyfork",
    idPrefix: "greasyfork-",
    query: "youtube",
    run: searchGreasyFork,
    routes: { "api.greasyfork.org/en/scripts.json": fx.greasyforkScripts },
    wrap: (items) => items,
    expectCount: 2,
    extra: (res) => {
      expect(res.projects[0].author.name).toBe("avi12");
      // Empty users[] → fallback, not a throw.
      expect(res.projects[1].author.name).toBe("unknown");
      expect(res.projects[0].downloads).toBe(1_250_000);
    },
  },
  {
    name: "searchTerraform",
    source: "terraform",
    idPrefix: "terraform-",
    query: "vpc",
    run: searchTerraform,
    routes: { "registry.terraform.io/v1/modules/search": fx.terraformModules },
    wrap: (items) => ({ modules: items }),
    expectCount: 2,
    extra: (res) => {
      expect(res.projects[0].fullName).toBe("terraform-aws-modules/vpc/aws");
      expect(res.projects[0].url).toBe(
        "https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws",
      );
      expect(res.projects[0].homepage).toBe(
        "https://github.com/terraform-aws-modules/terraform-aws-vpc",
      );
    },
  },
  {
    name: "searchSnapcraft",
    source: "snap",
    idPrefix: "snap-",
    query: "vlc",
    run: searchSnapcraft,
    routes: { "api.snapcraft.io/v2/snaps/find": fx.snapFind },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
    extra: (res) => {
      // Version comes from the sibling `revision`, not `snap`.
      expect(res.projects[0].version).toBe("3.0.20-1");
      // The find API exposes no install metric — downloads stays honest-empty.
      for (const p of res.projects) expect(p.downloads).toBeUndefined();
      expect(res.projects[0].url).toBe("https://snapcraft.io/vlc");
      expect(res.projects[0].author.name).toBe("VideoLAN");
    },
  },
  {
    name: "searchAnsibleGalaxy",
    source: "ansible",
    idPrefix: "ansible-",
    query: "docker",
    run: searchAnsibleGalaxy,
    routes: { "galaxy.ansible.com/api/v3/plugin": fx.ansibleCollections },
    wrap: (items) => ({ data: items }),
    // Fixture carries 3 items; the is_deprecated one must be dropped.
    expectCount: 2,
    extra: (res) => {
      expect(res.projects.map((p) => p.fullName)).not.toContain(
        "community.docker_legacy",
      );
      expect(res.projects[0].fullName).toBe("community.docker");
      expect(res.projects[0].url).toBe(
        "https://galaxy.ansible.com/ui/repo/published/community/docker/",
      );
    },
  },
  {
    name: "searchGnomeExtensions",
    source: "gnome",
    idPrefix: "gnome-",
    query: "dash",
    run: searchGnomeExtensions,
    routes: { "extensions.gnome.org/extension-query": fx.gnomeExtensions },
    wrap: (items) => ({ extensions: items }),
    expectCount: 2,
    extra: (res) => {
      // Site-relative `link` is absolutized.
      expect(res.projects[0].url).toBe(
        "https://extensions.gnome.org/extension/307/dash-to-dock/",
      );
      // Absolute `url` field maps to homepage; empty string maps to none.
      expect(res.projects[0].homepage).toBe("https://micheleg.github.io/dash-to-dock/");
      expect(res.projects[1].homepage).toBeUndefined();
    },
  },
  {
    name: "searchChocolatey",
    source: "chocolatey",
    idPrefix: "chocolatey-",
    query: "git",
    run: searchChocolatey,
    // Atom XML, not JSON — route returns a fresh raw-XML Response per call.
    routes: {
      "community.chocolatey.org/api/v2/Search": () =>
        new Response(fx.chocolateyAtom, {
          status: 200,
          headers: { "Content-Type": "application/atom+xml" },
        }),
    },
    // Entries without title/properties must be filtered, never thrown on.
    wrap: (items) => () =>
      new Response(
        `<?xml version="1.0"?><feed>${items
          .map(() => "<entry><m:properties></m:properties></entry>")
          .join("")}</feed>`,
        { status: 200, headers: { "Content-Type": "application/atom+xml" } },
      ),
    expectCount: 2,
    extra: (res) => {
      // <title> = package id, <d:Title> = display name.
      expect(res.projects[0].name).toBe("Git");
      expect(res.projects[0].fullName).toBe("git");
      expect(res.projects[0].url).toBe(
        "https://community.chocolatey.org/packages/git/2.49.0",
      );
      // DownloadCount parses through its m:type attribute.
      expect(res.projects[0].downloads).toBe(14_882_190);
      expect(res.projects[0].version).toBe("2.49.0");
    },
  },
  {
    name: "searchVcpkg",
    source: "vcpkg",
    idPrefix: "vcpkg-",
    query: "fmt",
    run: searchVcpkg,
    routes: { "/api/search-vcpkg": fx.vcpkgBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
    extra: (res) => {
      // Card links to the vcpkg.io package page; the index's (lowercase)
      // homepage maps to `homepage`.
      expect(res.projects[0].url).toBe("https://vcpkg.io/en/package/fmt");
      expect(res.projects[0].homepage).toBe("https://github.com/fmtlib/fmt");
      // vcpkg exposes no stars AND no downloads — both stay honestly empty.
      for (const p of res.projects) {
        expect(p.stars).toBe(0);
        expect(p.downloads).toBeUndefined();
      }
      expect(res.projects[0].license).toBe("MIT");
      expect(res.projects[0].version).toBe("12.1.0");
      // LastModified survives as a real updatedAt (ISO from the backend).
      expect(res.projects[0].updatedAt).toBe("2025-10-31T00:00:00.000Z");
    },
  },
  {
    name: "searchMelpa",
    source: "melpa",
    idPrefix: "melpa-",
    query: "magit",
    run: searchMelpa,
    routes: { "/api/search-melpa": fx.melpaBackend },
    wrap: (items) => ({ results: items }),
    expectCount: 2,
    extra: (res) => {
      // Card links to the MELPA package page (SPA hash route); props.url
      // (the upstream repo) maps to `homepage`, not `url`.
      expect(res.projects[0].url).toBe("https://melpa.org/#/magit");
      expect(res.projects[0].homepage).toBe("https://github.com/magit/magit");
      // download_counts.json joins into the honest downloads channel —
      // never fake stars.
      expect(res.projects[0].downloads).toBe(5_176_602);
      for (const p of res.projects) expect(p.stars).toBe(0);
      expect(res.projects[0].version).toBe("20260609.956");
      // Emacs finder keywords become topic chips.
      expect(res.projects[0].topics).toEqual(["git", "tools", "vc"]);
    },
  },
];

beforeEach(() => {
  // Adapters console.error on every failure path by design; keep the suite
  // output readable. restoreMocks puts console back after each test.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("adapter golden payloads — happy path", () => {
  it.each(CASES)("$name maps its fixture into UnifiedProjects", async (c) => {
    const mock = routedFetch(c.routes);
    const res = await c.run(c.query);
    expect(res.source).toBe(c.source);
    expect(Array.isArray(res.projects)).toBe(true);
    expect(res.projects).toHaveLength(c.expectCount);
    expect(res.totalCount).toBeGreaterThanOrEqual(c.expectCount);
    for (const p of res.projects) {
      expect(p.id.startsWith(c.idPrefix)).toBe(true);
      expect(p.source).toBe(c.source);
      expect(p.url).toMatch(/^https:\/\//);
      expect(typeof p.stars).toBe("number");
      expect(p.stars).toBeGreaterThanOrEqual(0);
      if (p.downloads !== undefined) {
        expect(typeof p.downloads).toBe("number");
        expect(p.downloads).toBeGreaterThanOrEqual(0);
      }
      expect(typeof p.author?.name).toBe("string");
    }
    c.extra?.(res, mock);
  });
});

describe("adapter never-throw degradation", () => {
  const degenerate = (c: AdapterCase, payload: unknown) =>
    Object.fromEntries(Object.keys(c.routes).map((frag) => [frag, payload]));

  it.each(CASES)("$name resolves on a {} envelope", async (c) => {
    routedFetch(degenerate(c, {}));
    const res = await c.run(c.query);
    expect(res.source).toBe(c.source);
    expect(Array.isArray(res.projects)).toBe(true);
  });

  it.each(CASES)("$name resolves on a [] envelope", async (c) => {
    routedFetch(degenerate(c, []));
    const res = await c.run(c.query);
    expect(res.source).toBe(c.source);
    expect(Array.isArray(res.projects)).toBe(true);
  });

  it.each(CASES)("$name resolves on items with missing/null fields", async (c) => {
    const items = [{}, { name: null, title: null, description: null, url: null }];
    routedFetch(degenerate(c, c.wrap(items)));
    const res = await c.run(c.query);
    expect(res.source).toBe(c.source);
    expect(Array.isArray(res.projects)).toBe(true);
  });
});

describe("adapter HTTP failure", () => {
  it.each(CASES)("$name returns [] on a non-ok response", async (c) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream sad", { status: 500 })),
    );
    const res = await c.run(c.query);
    expect(res.projects).toEqual([]);
    expect(res.source).toBe(c.source);
  });

  it.each(CASES)("$name returns [] on a network rejection", async (c) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const res = await c.run(c.query);
    expect(res.projects).toEqual([]);
    expect(res.source).toBe(c.source);
  });
});

describe("adapter AbortSignal threading", () => {
  it.each(CASES)("$name forwards the signal to every fetch", async (c) => {
    const mock = routedFetch(c.routes);
    const controller = new AbortController();
    await c.run(c.query, controller.signal);
    expect(mock.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of mock.mock.calls) {
      expect((init as RequestInit | undefined)?.signal).toBe(controller.signal);
    }
  });
});

describe("WordPress real-world date format (regression)", () => {
  it('parses "2026-04-01 4:54pm GMT" instead of throwing the source empty', async () => {
    routedFetch({ "api.wordpress.org/plugins": fx.wordpressRealDateFormat });
    const res = await searchWordPress("cache");
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].updatedAt).toBe("2026-04-01T16:54:00.000Z");
  });

  it("maps an unparseable date to '' rather than throwing", async () => {
    routedFetch({
      "api.wordpress.org/plugins": {
        plugins: [{ slug: "x", name: "X", last_updated: "not a date at all" }],
      },
    });
    const res = await searchWordPress("x");
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].updatedAt).toBe("");
  });
});
