"use client";

import { useState } from "react";
import type { UnifiedProject } from "@/lib/sources/types";
import { SourceBadge } from "./card/SourceBadge";
import { CardPills } from "./card/CardPills";
import { CardActions, type CopyItem } from "./card/CardActions";
import { AnimatedCard } from "./motion/AnimatedCard";
import { motion, useAnimationControls } from "framer-motion";
import { bookmarkVariants } from "@/lib/motion";
import { useBookmark } from "@/lib/bookmarks";
import {
  formatCount,
  licenseBucket,
  maintenanceState,
  copyItemsForSource,
} from "./card/helpers";

export function UnifiedProjectCard({ project }: { project: UnifiedProject }) {
  const { isBookmarked, toggle } = useBookmark(project);
  const [copied, setCopied] = useState<string | null>(null);
  const bookmarkControls = useAnimationControls();

  const popularity =
    project.stars > 0
      ? `★ ${formatCount(project.stars)}`
      : project.downloads
        ? `↓ ${formatCount(project.downloads)}`
        : null;

  const copyItems: CopyItem[] = copyItemsForSource(project);

  const isRepo =
    project.source === "github" ||
    project.source === "gitlab" ||
    project.source === "codeberg";

  return (
    <AnimatedCard layoutId={project.id}>
      <article className="ts-card glass">
        <div className="ts-top">
          <SourceBadge source={project.source} />
          <motion.button
            className={`ts-bookmark ${isBookmarked ? "bookmarked" : ""}`}
            variants={bookmarkVariants}
            animate={bookmarkControls}
            onClick={() => {
              toggle();
              bookmarkControls
                .start("tapped")
                .then(() => bookmarkControls.start("rest"));
            }}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {isBookmarked ? "♥" : "♡"}
          </motion.button>
        </div>
        <h3 className="ts-title">
          {project.name}
          {project.fullName !== project.name && (
            <span className="ts-title-sub">
              {isRepo ? `by ${project.fullName.split("/")[0]}` : project.fullName}
            </span>
          )}
        </h3>
        <p className="ts-desc">{project.description ?? ""}</p>
        <CardPills
          popularity={popularity}
          language={project.language}
          license={licenseBucket(project.license)}
          maintenance={maintenanceState(project.updatedAt)}
        />
        <CardActions
          url={project.url}
          copyItems={copyItems}
          onCopy={(text) => {
            setCopied(text);
            setTimeout(() => setCopied(null), 1500);
          }}
        />
        {copied && <div className="ts-toast">Copied: {copied.slice(0, 40)}</div>}
      </article>
    </AnimatedCard>
  );
}
