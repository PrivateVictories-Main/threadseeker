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
    <main className="min-h-screen flex items-center justify-center px-6 py-10 text-slate-800">
      <div className="max-w-md w-full space-y-4 rounded-xl border border-indigo-200 bg-white/85 backdrop-blur-md p-6 shadow-lg">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="w-5 h-5" />
          <h1 className="text-base font-semibold">Something broke on our side.</h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          ThreadSeeker ran into an unexpected error. Your search query is still
          in the URL bar, so you can try again.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-500 font-mono break-all">
            digest: {error.digest}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 border border-transparent rounded-lg px-3.5 py-2 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
          <a
            href="/"
            className="text-sm text-slate-600 hover:text-indigo-700 px-3 py-2 font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
