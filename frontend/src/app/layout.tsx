import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

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
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-black`}
      >
        <Providers>
          {children}
        </Providers>
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
