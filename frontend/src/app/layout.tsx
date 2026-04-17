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
  title: "ThreadSeeker — Search open source everywhere",
  description: "One search across GitHub, Hugging Face, GitLab, npm, PyPI, crates.io, and more. Find projects, models, and packages instantly.",
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
