import type { Metadata } from "next";
import Link from "next/link";

// Explicit not-found page: the auto-404 inherited the layout's canonical
// to "/" alongside its noindex — a noindex'd error page claiming the
// homepage as canonical is exactly the meta-hygiene leak the layout
// cleanup removed elsewhere. Overriding here keeps 404s noindex'd with
// NO canonical.
export const metadata: Metadata = {
  title: "Page not found — ThreadSeeker",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "48px 24px",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ts-text-faint)",
            marginBottom: 12,
          }}
        >
          404 — thread not found
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
          This page doesn&apos;t exist.
        </h1>
        <p style={{ color: "var(--ts-text-subtle)", marginBottom: 24 }}>
          The search engine is still here, though.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 22px",
            borderRadius: 999,
            background: "var(--ts-accent-gradient)",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Back to ThreadSeeker
        </Link>
      </div>
    </main>
  );
}
