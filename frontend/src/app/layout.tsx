import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion/MotionProvider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://threadseeker.pages.dev"),
  title: "ThreadSeeker — Search open source everywhere",
  description:
    "One query across 28 open-source platforms: GitHub, Hugging Face, npm, PyPI, crates.io, Maven Central, NuGet, Docker Hub, conda-forge, AUR, Open VSX, arXiv, Reddit, HN, and more. Free, no account, no tracking.",
  keywords: [
    "open source search",
    "github search",
    "npm search",
    "pypi search",
    "huggingface search",
    "docker hub search",
    "conda-forge",
    "package search",
    "developer tools",
  ],
  authors: [{ name: "ThreadSeeker" }],
  openGraph: {
    title: "ThreadSeeker — Search open source everywhere",
    description:
      "One query across 28 open-source platforms. GitHub, npm, PyPI, Maven, NuGet, Hugging Face, Docker Hub, conda-forge, AUR, Open VSX, arXiv, and more.",
    url: "https://threadseeker.pages.dev",
    siteName: "ThreadSeeker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreadSeeker — Search open source everywhere",
    description:
      "One query across 28 open-source platforms. Find repos, packages, models, and community threads.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#eef2ff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Warm up DNS + TLS for every host we fetch directly from the browser.
            Saves ~50-150ms per source on the first query. */}
        {/* Schema.org SiteSearch — lets Google render a sitelinks search box
            and exposes the homepage as a WebSite entity with a SearchAction. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ThreadSeeker",
              alternateName: "ThreadSeeker — unified open-source search",
              url: "https://threadseeker.pages.dev",
              description:
                "Unified search across 28 open-source platforms. GitHub, npm, PyPI, Maven, Hugging Face, Docker Hub, and more.",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://threadseeker.pages.dev/?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {[
          "https://api.github.com",
          "https://avatars.githubusercontent.com",
          "https://huggingface.co",
          "https://gitlab.com",
          "https://registry.npmjs.org",
          "https://pypi.org",
          "https://crates.io",
          "https://codeberg.org",
          "https://repo.packagist.org",
          "https://rubygems.org",
          "https://hn.algolia.com",
          "https://open-vsx.org",
          "https://dev.to",
          "https://jsr.io",
          "https://www.reddit.com",
        ].map((href) => (
          <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
        ))}
      </head>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen`}
      >
        <MotionProvider>{children}</MotionProvider>
        <Toaster
          position="bottom-right"
          // 4-toast stack: a burst of copy-success toasts (e.g.
          // "Markdown copied" + "Link copied" in quick succession)
          // visibly stacks instead of clobbering the previous one.
          // Sonner default is 3 — a touch tight for our flow.
          visibleToasts={4}
          // Closing on click is more forgiving than the small X target
          // on a touch surface — tap-anywhere dismisses without
          // requiring tight-target accuracy.
          closeButton={false}
          toastOptions={{
            // 3.2s default duration. Sonner's default is 4s; trimmed
            // because our toasts are short ("Copied: ...", "Saved
            // bookmark") and 4s feels lingering on a desktop with a
            // hot-active flow.
            duration: 3200,
            style: {
              background: "rgba(255, 255, 255, 0.94)",
              border: "1px solid rgba(99, 102, 241, 0.22)",
              color: "#0f172a",
              // Layered shadow: a tight inner ring for definition + a
              // softer outer drop so the toast reads as floating glass
              // above the gradient body without a single flat shadow
              // line. Mirrors the .glass shadow vocabulary.
              boxShadow:
                "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.08)",
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
              borderRadius: "14px",
              fontSize: "13px",
              padding: "10px 14px",
            },
          }}
        />
      </body>
    </html>
  );
}
