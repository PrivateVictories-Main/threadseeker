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
// pooling, no query prefix needed. Apache-2.0. Weights come from the HF Hub
// CDN (free, CORS-enabled) and transformers.js caches them in the browser
// Cache API — one download per browser, then offline-capable.
const MODEL_ID = "mixedbread-ai/mxbai-embed-xsmall-v1";

let extractorPromise = null;

function getExtractor() {
  extractorPromise ??= (async () => {
    const { pipeline, env } = await import(TRANSFORMERS_URL);
    // Explicit single-thread WASM: avoids needing COOP/COEP isolation, which
    // would force CORP on every cross-origin fetch sitewide. The fast path is
    // WebGPU anyway (v4 falls back to WASM automatically).
    if (env?.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1;
    return pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
      device: "webgpu",
    });
  })();
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
