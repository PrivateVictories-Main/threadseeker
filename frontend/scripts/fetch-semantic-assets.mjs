// Downloads the semantic-rerank model into public/models/ so the app serves
// it SAME-ORIGIN instead of every visitor fetching ~24 MB from the Hugging
// Face CDN. Runs as `prebuild`/`predev` (skip-if-exists, so it costs nothing
// after the first run) and the directory is gitignored — the repo stays lean
// and the deploy (wrangler dedupes uploads by content hash) pays the 24 MB
// once, not per deploy.
//
// Why self-host the MODEL but not the ONNX runtime: the model is the
// heavyweight piece (23.3 MiB, fits under Cloudflare Pages' 25 MiB per-asset
// limit) and pinning it removes the only third-party dependency end users
// hit at search time. The runtime's WebGPU wasm is 24.9 MiB — one upstream
// patch away from breaking every deploy — so it stays on pinned jsDelivr.
//
// The worker (public/workers/semantic-embed.worker.js) loads local-first and
// falls back to the HF Hub CDN if these files are missing, so a failed or
// skipped prebuild degrades gracefully instead of breaking search.

import { mkdir, stat, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// PINNED to a revision SHA, not `main`: vendored bytes are reproducible
// across machines/CI, and the 1-year-immutable /models/* cache headers are
// honest. UPGRADE RULE: never replace bytes at the same served path — a
// model change must change the directory (different model id) or add a
// version segment, because both the HTTP cache (immutable) and
// transformers.js' Cache API never revalidate.
const MODEL_REVISION = "e6ac24e5d6efb8782b59de1647b3ececb4ece94e";
const HF_BASE =
  `https://huggingface.co/mixedbread-ai/mxbai-embed-xsmall-v1/resolve/${MODEL_REVISION}`;
// Served at /models/mixedbread-ai/mxbai-embed-xsmall-v1/… — the FULL org id,
// deliberately: transformers.js caches by id-derived keys, and the full id
// makes a returning user's pre-existing HF-CDN cache entries an exact hit
// (an org-less id would force the whole user base to re-download 23 MiB).
const OUT_DIR = join(
  ROOT, "public", "models", "mixedbread-ai", "mxbai-embed-xsmall-v1",
);

// Everything transformers.js requests for a q8 feature-extraction pipeline.
// minBytes is a sanity floor so a CDN error page can't masquerade as a model.
const FILES = [
  { path: "config.json", minBytes: 200 },
  { path: "tokenizer.json", minBytes: 100_000 },
  { path: "tokenizer_config.json", minBytes: 200 },
  { path: "special_tokens_map.json", minBytes: 100 },
  { path: "onnx/model_quantized.onnx", minBytes: 20_000_000 },
];

async function exists(p, minBytes) {
  try {
    const s = await stat(p);
    return s.size >= minBytes;
  } catch {
    return false;
  }
}

async function download(rel, minBytes) {
  const dest = join(OUT_DIR, rel);
  if (await exists(dest, minBytes)) {
    console.log(`  ✓ ${rel} (cached)`);
    return;
  }
  const url = `${HF_BASE}/${rel}`;
  // Bounded waits: a captive portal / blackholing firewall must not hold
  // `npm run dev` startup hostage (the hook runs before every dev/build).
  const timeoutMs = minBytes > 1_000_000 ? 180_000 : 15_000;
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) {
    throw new Error(`${rel}: ${buf.length}B < expected ${minBytes}B floor`);
  }
  await mkdir(dirname(dest), { recursive: true });
  // Write-then-rename so a half-written file never passes the exists() check.
  const tmp = `${dest}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, dest);
  console.log(`  ↓ ${rel} (${(buf.length / 1048576).toFixed(1)} MiB)`);
}

try {
  console.log("semantic assets → public/models/mixedbread-ai/mxbai-embed-xsmall-v1");
  for (const f of FILES) {
    await download(f.path, f.minBytes);
  }
  console.log("  done");
} catch (err) {
  // Non-fatal by design: the worker falls back to the HF CDN at runtime, so
  // an offline/firewalled build still produces a fully working site.
  console.warn(`  semantic asset fetch skipped: ${err.message}`);
  console.warn("  (worker will fall back to the Hugging Face CDN at runtime)");
}
