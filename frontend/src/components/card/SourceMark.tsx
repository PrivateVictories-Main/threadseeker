import type { SourceType } from "@/lib/sources/types";
import { getSourceIcon } from "@/lib/sources/registry";
import { getBrandMark } from "@/lib/sources/brand-icons";

interface Props {
  source: SourceType;
  /** Tailwind sizing (+ any extra) classes. Defaults to a 14px square. */
  className?: string;
}

// Renders a source's real vendor brand mark in its brand color (theme-safe via
// CSS vars — see .ts-brandmark in globals.css). Falls back to the registry
// lucide glyph for the few sources without a simple-icons mark.
export function SourceMark({ source, className = "w-3.5 h-3.5" }: Props) {
  const brand = getBrandMark(source);
  if (brand) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`ts-brandmark ${className}`}
        style={{
          ["--brand" as string]: brand.hex,
          ["--brand-dark" as string]: brand.darkHex ?? brand.hex,
        }}
        fill="currentColor"
        role="img"
        aria-hidden
      >
        <path d={brand.path} />
      </svg>
    );
  }
  const Icon = getSourceIcon(source);
  return <Icon className={className} aria-hidden />;
}
