// arXiv search. arXiv's API returns Atom XML, so we parse it server-side
// and hand back a clean JSON list. 6-hour edge cache — new papers land
// daily but rarely within a single session.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery } from "../_shared/http";

interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  url: string;
  pdf: string;
  updated: string;
  published: string;
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }
  const query = sanitizeQuery(body.query);
  if (!query) return jsonResponse({ detail: "Query required" }, 400);

  return cachedJson(request, [query.toLowerCase(), "arxiv-v1"], 60 * 60 * 6, async () => {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=25&sortBy=relevance&sortOrder=descending`;
      const res = await fetch(url, {
        cf: { cacheTtl: 60 * 60 * 6, cacheEverything: true },
      } as RequestInit);
      if (!res.ok) return { results: [] };
      const xml = await res.text();
      return { results: parseAtom(xml) };
    } catch {
      return { results: [] };
    }
  });
};

// Minimal Atom/XML parser good enough for arXiv's well-formed output.
function parseAtom(xml: string): ArxivPaper[] {
  const entries: ArxivPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(xml)) !== null) {
    const e = m[1];
    const id = tag(e, "id");
    const title = tag(e, "title").replace(/\s+/g, " ").trim();
    const summary = tag(e, "summary").replace(/\s+/g, " ").trim();
    const authors: string[] = [];
    const authorRe = /<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g;
    let am: RegExpExecArray | null;
    while ((am = authorRe.exec(e)) !== null) authors.push(am[1].trim());

    const categories: string[] = [];
    const catRe = /<category\s+term="([^"]+)"/g;
    let cm: RegExpExecArray | null;
    while ((cm = catRe.exec(e)) !== null) categories.push(cm[1]);

    let pdf = "";
    const linkRe = /<link[^>]*?title="pdf"[^>]*?href="([^"]+)"/;
    const linkMatch = e.match(linkRe);
    if (linkMatch) pdf = linkMatch[1];

    entries.push({
      id,
      title,
      summary: summary.slice(0, 400),
      authors,
      categories,
      url: id, // arXiv id is already an abs URL
      pdf,
      updated: tag(e, "updated"),
      published: tag(e, "published"),
    });
  }
  return entries;
}

function tag(src: string, name: string): string {
  const m = src.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : "";
}
