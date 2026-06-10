"use client";

// Iter-23 / Major Overhaul I — list-view row.
//
// Dense horizontal-stripe representation of a UnifiedProject for the
// new "List" view in results. Spotify list-row / Linear-issue feel:
// the row is full-width, ~64px tall, with a single horizontal flow:
//
//   [avatar] [name + author + source]   [description (1-line)]   [stats]   [open ↗]
//
// Click anywhere on the body opens the project in a new tab; the
// inline "details" affordance opens the right-side detail drawer.
//
// Visual register matches the rest of the system: glass body, indigo
// hover lift, mono microcopy for source/stats. The bookmark heart from
// the grid card is dropped here in favor of a hover-revealed "save"
// affordance — list view prioritizes scannability over per-row
// chrome density.

import type { UnifiedProject } from "@/lib/sources/types";
import { Highlight } from "./Highlight";
import { Avatar } from "./card/Avatar";
import { SourceMark } from "./card/SourceMark";
import { IdentityRibbon } from "./card/IdentityRibbon";
import { motion } from "framer-motion";
import { Star, ExternalLink, Heart, ChevronRight } from "lucide-react";
import { useBookmark } from "@/lib/bookmarks";
import { getSourceConfig } from "@/lib/sources/registry";
import { safeHref } from "@/lib/utils";
import {
  formatCount,
  formatRelativeShort,
  popularityClass,
} from "./card/helpers";
import { cardVariants } from "@/lib/motion";

interface Props {
  project: UnifiedProject;
  index?: number;
  onToast?: (msg: string) => void;
  onTopicClick?: (topic: string) => void;
  onOpenDetails?: (project: UnifiedProject) => void;
  focused?: boolean;
  /** Active free-text query — matched terms get <mark>-highlighted. */
  query?: string;
  /** Iter-24 — when set and matches this row's project id, picks up
   *  the indigo flash ring (used after the user opens a row's details
   *  drawer). */
  flashId?: string | null;
}

export function ProjectListRow({
  project,
  index,
  onOpenDetails,
  focused,
  flashId,
  query,
}: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
  const cfg = getSourceConfig(project.source);
  const popClass = popularityClass(project);

  const isRepo =
    project.source === "github" ||
    project.source === "gitlab" ||
    project.source === "codeberg";

  const avatar = project.author?.avatar;
  const subline = isRepo
    ? project.fullName.includes("/")
      ? project.fullName.split("/")[0]
      : ""
    : project.fullName !== project.name
      ? project.fullName
      : "";

  const updated = project.updatedAt
    ? formatRelativeShort(project.updatedAt)
    : null;

  const isFlash = flashId === project.id;

  return (
    <motion.div
      role="listitem"
      data-result-card=""
      data-result-id={project.id}
      data-result-url={project.url}
      data-source={project.source}
      data-pop={popClass ?? undefined}
      className={`ts-list-row${focused ? " is-focused" : ""}${isFlash ? " is-flash" : ""}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      transition={{ delay: ((index ?? 0) % 12) * 0.018 }}
    >
      {/* Source-tinted left edge — shared DNA with the grid card's cover. */}
      <IdentityRibbon source={project.source} />

      {/* Avatar */}
      <Avatar
        src={avatar}
        name={project.name}
        id={project.id}
        className="ts-list-avatar"
        fallbackClassName="ts-list-avatar-fallback"
      />

      {/* Identity block */}
      <div className="ts-list-identity">
        <a
          href={safeHref(project.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="ts-list-name"
          title={project.fullName}
        >
          <Highlight text={project.name} query={query} />
        </a>
        <div className="ts-list-meta">
          <span className="ts-list-source">
            <SourceMark source={project.source} className="w-3 h-3" />
            <span>{cfg.name}</span>
          </span>
          {subline && (
            <>
              <span className="ts-list-sep">·</span>
              <span className="ts-list-author">{subline}</span>
            </>
          )}
          {project.version && (
            <>
              <span className="ts-list-sep">·</span>
              <span className="ts-list-version">v{project.version}</span>
            </>
          )}
          {updated && (
            <>
              <span className="ts-list-sep">·</span>
              <span className="ts-list-updated">{updated}</span>
            </>
          )}
        </div>
      </div>

      {/* Description — 1-line clamp, hidden under sm. */}
      {project.description && (
        <p className="ts-list-desc">
          <Highlight text={project.description} query={query} />
        </p>
      )}

      {/* Stats + actions cluster on the right. */}
      <div className="ts-list-stats">
        {typeof project.stars === "number" && project.stars > 0 && (
          <span className="ts-list-stat" title={`${project.stars.toLocaleString()} stars`}>
            <Star className="w-3 h-3 text-amber-500" aria-hidden />
            <span className="tabular-nums">{formatCount(project.stars)}</span>
          </span>
        )}
        {project.language && (
          <span className="ts-list-stat ts-list-lang">{project.language}</span>
        )}
      </div>

      <div className="ts-list-actions">
        <motion.button
          type="button"
          onClick={() => toggle()}
          className={`ts-list-bookmark${isBookmarked ? " is-on" : ""}`}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          title={isBookmarked ? "Saved" : "Save"}
          whileTap={{ scale: 1.25 }}
          transition={{ type: "spring", stiffness: 320, damping: 14 }}
        >
          <Heart
            className="w-3.5 h-3.5"
            fill={isBookmarked ? "currentColor" : "none"}
            aria-hidden
          />
        </motion.button>
        {onOpenDetails && (
          <motion.button
            type="button"
            onClick={() => onOpenDetails(project)}
            className="ts-list-details"
            title="View details"
            whileTap={{ scale: 0.97 }}
          >
            Details
          </motion.button>
        )}
        <a
          href={safeHref(project.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="ts-list-open"
          title="Open"
          aria-label={`Open ${project.name} in a new tab`}
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>

      {/* Iter-24 — chevron-on-hover. Slides in from the right edge as
          the cursor enters the row. */}
      <ChevronRight className="ts-list-chevron w-4 h-4" aria-hidden />
    </motion.div>
  );
}
