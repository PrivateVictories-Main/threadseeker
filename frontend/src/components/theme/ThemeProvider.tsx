"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin wrapper so the (server) layout can mount next-themes without becoming a
// client component itself. attribute="class" → adds `class="dark"` to <html>,
// which our token + utility dark layers key off.
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
