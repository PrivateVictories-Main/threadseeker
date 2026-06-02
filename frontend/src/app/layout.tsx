import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

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
    "One query across 29 open-source platforms: GitHub, Hugging Face, npm, PyPI, crates.io, Maven Central, NuGet, Docker Hub, conda-forge, AUR, Open VSX, arXiv, Reddit, HN, and more. Free, no account, no tracking.",
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
      "One query across 29 open-source platforms. GitHub, npm, PyPI, Maven, NuGet, Hugging Face, Docker Hub, conda-forge, AUR, Open VSX, arXiv, and more.",
    url: "https://threadseeker.pages.dev",
    siteName: "ThreadSeeker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreadSeeker — Search open source everywhere",
    description:
      "One query across 29 open-source platforms. Find repos, packages, models, and community threads.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                "Unified search across 29 open-source platforms. GitHub, npm, PyPI, Maven, Hugging Face, Docker Hub, and more.",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>{children}</MotionProvider>
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          // 4-toast stack: a burst of copy-success toasts (e.g.
          // "Markdown copied" + "Link copied" in quick succession)
          // visibly stacks instead of clobbering the previous one.
          // Sonner default is 3 — a touch tight for our flow.
          visibleToasts={4}
          // closeButton enabled so desktop keyboard users have an
          // explicit X target (Esc dismisses too, but the X is
          // discoverable). On touch widths the button is hidden via
          // CSS (`@media (max-width: 767px)` → `display: none`) so
          // the friendly tap-anywhere dismiss still reigns there.
          // Styling lives in globals.css under `.toaster
          // [data-close-button]`.
          closeButton={true}
          toastOptions={{
            // 3.2s default duration. Sonner's default is 4s; trimmed
            // because our toasts are short ("Copied: ...", "Saved
            // bookmark") and 4s feels lingering on a desktop with a
            // hot-active flow.
            duration: 3200,
            style: {
              // Token-driven so the toast adapts to light/dark.
              background: "var(--ts-surface-strong)",
              border: "1px solid var(--ts-border)",
              color: "var(--ts-text)",
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
