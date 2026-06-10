// ThreadSeeker semantic-rerank worker (plain ESM, served statically).
//
// Runs a small retrieval-trained embedding model (mxbai-embed-xsmall-v1,
// ~24 MB quantized) ENTIRELY in the user's browser via transformers.js —
// no API, no key, no cost, cached after the first load. This is what lets a
// 2-3 sentence description of a project rank results by *meaning* instead of
// keyword overlap, for every user, free.
//
// Deliberately a static file (not a bundled chunk): transformers.js +
// onnxruntime-web resist webpack/SWC bundling (import.meta + dynamic-require
// shims in the ORT bundles), and the runtime never belongs in the app bundle
// anyway. The library is imported at runtime, PINNED, from jsDelivr; the CSP
// in public/_headers allowlists exactly that host (+ 'wasm-unsafe-eval' for
// the ONNX runtime). Any import/download failure posts "error" and the app
// silently keeps its deterministic BM25 order.

const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

// Retrieval-trained MiniLM-class model: same speed/size class as
// all-MiniLM-L6-v2 but tuned for query→short-docs matching, 384-dim, mean
// pooling, no query prefix needed. Apache-2.0.
//
// Weights are served SAME-ORIGIN from /models/ (vendored at build time by
// scripts/fetch-semantic-assets.mjs) — visitors never depend on a
// third-party CDN for the heavyweight download. If the local copy is
// missing (skipped prebuild, partial deploy), we fall back to the HF Hub
// CDN. Either way transformers.js caches the files in the browser Cache
// API — one download per browser, then offline-capable.
const LOCAL_MODEL_ID = "mxbai-embed-xsmall-v1";
const REMOTE_MODEL_ID = "mixedbread-ai/mxbai-embed-xsmall-v1";

let extractorPromise = null;

async function detectDevice() {
  // Despite the docs, device:"webgpu" does NOT fall back on its own — and
  // worse, a FAILED webgpu pipeline attempt poisons ORT's backend registry
  // for the whole worker, so a subsequent device:"wasm" retry fails with the
  // same webgpu error (verified in headless Chromium). The only safe order
  // is: probe for a real GPU adapter FIRST (requestAdapter resolves null on
  // denylisted/headless machines where navigator.gpu still exists), and only
  // then commit to a single pipeline attempt on the proven device.
  try {
    if (typeof navigator !== "undefined" && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    /* probe failure = no GPU — wasm it is */
  }
  return "wasm";
}

async function buildExtractor() {
  const { pipeline, env } = await import(TRANSFORMERS_URL);
  // Explicit single-thread WASM: avoids needing COOP/COEP isolation, which
  // would force CORP on every cross-origin fetch sitewide.
  if (env?.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1;
  const device = await detectDevice();

  // Local-first: same-origin /models/<id>/… (cheap existence probe keeps the
  // failure path fast and avoids transformers.js poisoning any internal state
  // with a half-failed local load).
  try {
    const probe = await fetch(`/models/${LOCAL_MODEL_ID}/config.json`, {
      method: "HEAD",
    });
    if (probe.ok) {
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = "/models/";
      return await pipeline("feature-extraction", LOCAL_MODEL_ID, {
        dtype: "q8",
        device,
      });
    }
  } catch {
    /* fall through to the HF Hub CDN */
  }
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  return pipeline("feature-extraction", REMOTE_MODEL_ID, {
    dtype: "q8",
    device,
  });
}

function getExtractor() {
  // Reset on total failure so a transient network error doesn't disable the
  // semantic layer for the whole session — the next search retries.
  extractorPromise ??= buildExtractor().catch((err) => {
    extractorPromise = null;
    throw err;
  });
  return extractorPromise;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s; // embeddings are L2-normalized → dot product IS cosine similarity
}

// Per-session embedding cache: re-searches mostly re-score the same projects,
// so follow-up queries cost one query embedding + dot products (<100 ms)
// instead of re-embedding the corpus.
const docCache = new Map();
const DOC_CACHE_MAX = 4000;

self.onmessage = async (e) => {
  const { id, query, docs } = e.data || {};
  try {
    const extractor = await getExtractor();

    const missing = docs.filter((d) => !docCache.has(d.key));
    // Small batches bound padding waste + peak memory on WASM.
    const BATCH = 32;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const out = await extractor(
        batch.map((d) => d.text),
        { pooling: "mean", normalize: true },
      );
      const dim = out.dims[out.dims.length - 1];
      const data = out.data;
      batch.forEach((d, j) => {
        docCache.set(d.key, data.slice(j * dim, (j + 1) * dim));
      });
    }
    // Crude bound: a session that somehow embeds thousands of docs resets the
    // cache rather than growing without limit.
    if (docCache.size > DOC_CACHE_MAX) docCache.clear();

    const q = await extractor(query, { pooling: "mean", normalize: true });
    const qVec = q.data;

    const scores = {};
    for (const d of docs) {
      const vec = docCache.get(d.key);
      if (vec) scores[d.key] = dot(qVec, vec);
    }
    self.postMessage({ type: "result", id, scores });
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
