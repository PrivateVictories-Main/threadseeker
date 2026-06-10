"use client";

// Main-thread side of the keyless semantic reranker. Owns a singleton Web
// Worker (created on first use), matches responses to requests by id, and
// exposes one promise-based call. Everything here is best-effort: any
// environment that can't run it (no Worker, Save-Data, model download fails)
// resolves to null and the deterministic BM25 order stands untouched.
//
// The worker is a STATIC module file (public/workers/semantic-embed.worker.js)
// that runtime-imports a pinned transformers.js from CDN — nothing ML-related
// ever touches the app bundle or the webpack build. This module itself is
// `await import()`ed from useSearch, so even this thin client is off the
// critical path.

export interface SemanticDoc {
  key: string;
  text: string;
}

type Pending = {
  resolve: (scores: Map<string, number> | null) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let permanentlyFailed = false;

function getWorker(): Worker | null {
  if (permanentlyFailed) return null;
  if (worker) return worker;
  try {
    worker = new Worker("/workers/semantic-embed.worker.js", {
      type: "module",
    });
  } catch {
    permanentlyFailed = true;
    return null;
  }
  worker.onmessage = (
    e: MessageEvent<{ type: string; id: number; scores?: Record<string, number>; message?: string }>,
  ) => {
    const { type, id, scores } = e.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (type === "result" && scores) {
      entry.resolve(new Map(Object.entries(scores)));
    } else {
      entry.resolve(null);
    }
  };
  worker.onerror = () => {
    // Worker-level crash (bad chunk, CSP, OOM): fail every in-flight request
    // and stop trying for the rest of the session.
    for (const [, entry] of pending) entry.resolve(null);
    pending.clear();
    worker?.terminate();
    worker = null;
    permanentlyFailed = true;
  };
  return worker;
}

/**
 * Should this query/result-set get a semantic pass at all? Pure + exported
 * for unit tests. Single-token lookups ("react") are already solved by
 * BM25 + the exact-name boost; tiny result sets have nothing to reorder; and
 * Save-Data users shouldn't pay a ~24 MB first-time model download.
 */
export function shouldSemanticRerank(
  query: string,
  resultCount: number,
  opts?: { saveData?: boolean; hasWorker?: boolean },
): boolean {
  const saveData =
    opts?.saveData ??
    (typeof navigator !== "undefined" &&
      Boolean((navigator as { connection?: { saveData?: boolean } }).connection?.saveData));
  const hasWorker =
    opts?.hasWorker ?? (typeof Worker !== "undefined");
  if (saveData || !hasWorker) return false;
  if (resultCount < 8) return false;
  const significant = (query.toLowerCase().match(/[a-z0-9]{2,}/g) || []).length;
  return significant >= 2;
}

/**
 * Score `docs` against `query` by meaning, in the browser, free. Resolves to
 * a map of doc key → cosine similarity (≈ -1..1, retrieval-typical 0..0.8),
 * or null when unavailable. Never throws; never blocks the caller's paint
 * (callers fire it after rendering the deterministic order).
 */
export function semanticScores(
  query: string,
  docs: SemanticDoc[],
): Promise<Map<string, number> | null> {
  const w = getWorker();
  if (!w || docs.length === 0) return Promise.resolve(null);
  const id = nextId++;
  return new Promise((resolve) => {
    // Generous ceiling: the first-ever call includes the one-time model
    // download. If even that window passes (offline, blocked CDN), resolve
    // null so the caller's state machine can settle on "unavailable" instead
    // of hanging in "scoring" forever.
    const timer = setTimeout(() => {
      if (pending.delete(id)) resolve(null);
    }, 120_000);
    pending.set(id, {
      resolve: (scores) => {
        clearTimeout(timer);
        resolve(scores);
      },
    });
    try {
      w.postMessage({ id, query, docs });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve(null);
    }
  });
}
