"use client";

// Route-segment error boundary. Next auto-invokes this component when a
// client-side render in / throws. Keeps the search box usable even if an
// adapter/renderer throws — prior behavior was a white screen.

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ThreadSeeker crashed:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-black text-slate-200">
      <div className="max-w-md w-full space-y-4 rounded-xl border border-slate-800/60 bg-slate-950/50 p-6">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-5 h-5" />
          <h1 className="text-sm font-medium">Something broke on our side.</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          ThreadSeeker ran into an unexpected error. Your search query is still
          in the URL bar, so you can try again.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-600 font-mono break-all">
            digest: {error.digest}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 text-xs text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
          <a
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
