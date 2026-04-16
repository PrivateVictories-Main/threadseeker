"use client";

import { useEffect, useState } from "react";
import { synthesizeResults, isBackendConfigured } from "@/lib/api-client";
import { UnifiedProject } from "@/lib/sources";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  query: string;
  projects: UnifiedProject[];
}

// Caches synthesis per-query so we don't refetch on remount.
const cache = new Map<string, string>();

export function SynthesisBox({ query, projects }: Props) {
  const [synthesis, setSynthesis] = useState<string | null>(
    cache.get(query) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isBackendConfigured() || !query || projects.length === 0) return;
    if (cache.has(query)) {
      setSynthesis(cache.get(query)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    synthesizeResults(query, projects)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          cache.set(query, result);
          setSynthesis(result);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, projects]);

  if (!isBackendConfigured() || failed) return null;
  if (!loading && !synthesis) return null;

  return (
    <div className="rounded-lg border border-violet-900/30 bg-gradient-to-br from-violet-950/20 via-slate-950/40 to-slate-950/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-medium text-violet-300 uppercase tracking-wider">
          AI summary
        </span>
      </div>
      {loading && !synthesis ? (
        <div className="flex items-center gap-2 text-slate-500 py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Synthesizing insights from {projects.length} results…</span>
        </div>
      ) : (
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {synthesis}
        </div>
      )}
    </div>
  );
}
