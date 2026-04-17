import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
    "One query across 24 open-source platforms: GitHub, Hugging Face, npm, PyPI, crates.io, Docker Hub, conda-forge, AUR, Open VSX, arXiv, Reddit, HN, and more. Free, no account, no tracking.",
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
      "One query across 24 open-source platforms. GitHub, npm, PyPI, Hugging Face, Docker Hub, conda-forge, AUR, Open VSX, arXiv, and more.",
    url: "https://threadseeker.pages.dev",
    siteName: "ThreadSeeker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ThreadSeeker — Search open source everywhere",
    description:
      "One query across 24 open-source platforms. Find repos, packages, models, and community threads.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Warm up DNS + TLS for every host we fetch directly from the browser.
            Saves ~50-150ms per source on the first query. */}
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
        ].map((href) => (
          <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
        ))}
      </head>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-black`}
      >
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(0, 0, 0, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
