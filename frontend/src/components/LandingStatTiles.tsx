"use client";

// Iter-23 / Major Overhaul I — landing stat tiles row.
//
// Wraps the existing StatTiles in a row container so it sits as a
// distinct content row in the new feed-style landing. The tiles
// themselves stay visually identical to Overhaul H — what changed is
// position and surrounding rhythm: they're no longer inside the hero
// stage, they're a row of their own between the hero and the featured
// projects strip.

import { StatTiles } from "./StatTiles";

interface Props {
  sourceCount: number;
}

export function LandingStatTiles({ sourceCount }: Props) {
  return (
    <div className="ts-landing-row ts-landing-row-tight">
      <StatTiles sourceCount={sourceCount} />
    </div>
  );
}
