"use client";

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
  formatRelativeTime,
  licenseBucket,
  maintenanceState,
  copyItemsForSource,
} from "./card/helpers";

interface Props {
  project: UnifiedProject;
  onToast?: (msg: string) => void;
}

export function UnifiedProjectCard({ project, onToast }: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
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

  const topics = (project.topics ?? []).slice(0, 3);
  const avatar = project.author?.avatar;
  const subline = isRepo
    ? project.fullName.includes("/")
      ? `by ${project.fullName.split("/")[0]}`
      : ""
    : project.fullName !== project.name
      ? project.fullName
      : "";

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

        <div className="ts-title-row">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="ts-avatar"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="ts-avatar" aria-hidden />
          )}
          <h3 className="ts-title">
            <span className="ts-title-main">{project.name}</span>
            {subline && <span className="ts-title-sub">{subline}</span>}
          </h3>
        </div>

        <p className="ts-desc">{project.description ?? ""}</p>

        {project.updatedAt && (
          <p className="ts-caption">
            updated {formatRelativeTime(project.updatedAt)}
          </p>
        )}

        {topics.length > 0 && (
          <div className="ts-topics">
            {topics.map((t) => (
              <span key={t} className="topic-chip">
                {t}
              </span>
            ))}
          </div>
        )}

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
            onToast?.(`Copied: ${text.slice(0, 40)}`);
          }}
        />
      </article>
    </AnimatedCard>
  );
}
