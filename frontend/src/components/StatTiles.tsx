"use client";

import { Globe, Lock, User, Eye, type LucideIcon } from "lucide-react";

// Iter-22 / Overhaul H — Track 3
//
// Glass-tile rework of the old `.ts-stat-strip`. Four tiles, each tinted
// to a different hue (indigo / emerald / violet / amber) with an icon, a
// numeric value, and a tracked mono label. Replaces the previous flat
// 4-cell mono strip — gives the landing page a tangible row of
// "system status" widgets right below the search bar.

interface TileDef {
  tone: "indigo" | "emerald" | "violet" | "amber";
  icon: LucideIcon;
  value: string;
  label: string;
}

interface Props {
  sourceCount: number;
}

export function StatTiles({ sourceCount }: Props) {
  const tiles: TileDef[] = [
    { tone: "indigo", icon: Globe, value: String(sourceCount), label: "Sources" },
    { tone: "emerald", icon: Lock, value: "0", label: "Paid APIs" },
    { tone: "violet", icon: User, value: "0", label: "Accounts" },
    { tone: "amber", icon: Eye, value: "None", label: "Tracking" },
  ];
  return (
    <div className="ts-stat-tiles" aria-label="ThreadSeeker stats">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.label} className="ts-stat-tile" data-tone={t.tone}>
            <span className="ts-stat-tile-icon" aria-hidden>
              <Icon className="w-4 h-4" />
            </span>
            <div className="ts-stat-tile-text">
              <span className="ts-stat-tile-value">{t.value}</span>
              <span className="ts-stat-tile-label">{t.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
