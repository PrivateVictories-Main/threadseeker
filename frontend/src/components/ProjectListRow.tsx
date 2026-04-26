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
import { motion } from "framer-motion";
import { Star, ExternalLink, Heart } from "lucide-react";
import { useBookmark } from "@/lib/bookmarks";
import { getSourceConfig } from "@/lib/sources";
import {
  avatarFallbackHue,
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
}

export function ProjectListRow({
  project,
  index,
  onOpenDetails,
  focused,
}: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
  const cfg = getSourceConfig(project.source);
  const SourceIcon = cfg.lucideIcon;
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

  return (
    <motion.div
      role="listitem"
      data-result-card=""
      data-result-id={project.id}
      data-result-url={project.url}
      data-source={project.source}
      data-pop={popClass ?? undefined}
      className={`ts-list-row${focused ? " is-focused" : ""}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      transition={{ delay: ((index ?? 0) % 12) * 0.018 }}
    >
      {/* Avatar */}
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="ts-list-avatar"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="ts-list-avatar ts-list-avatar-fallback"
          aria-hidden
          style={{ ["--ts-fallback-hue" as string]: avatarFallbackHue(project.id) }}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Identity block */}
      <div className="ts-list-identity">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ts-list-name"
          title={project.fullName}
        >
          {project.name}
        </a>
        <div className="ts-list-meta">
          <span className="ts-list-source">
            <SourceIcon className="w-3 h-3" aria-hidden />
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
        <p className="ts-list-desc">{project.description}</p>
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
        <button
          type="button"
          onClick={() => toggle()}
          className={`ts-list-bookmark${isBookmarked ? " is-on" : ""}`}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          title={isBookmarked ? "Saved" : "Save"}
        >
          <Heart
            className="w-3.5 h-3.5"
            fill={isBookmarked ? "currentColor" : "none"}
            aria-hidden
          />
        </button>
        {onOpenDetails && (
          <button
            type="button"
            onClick={() => onOpenDetails(project)}
            className="ts-list-details"
            title="View details"
          >
            Details
          </button>
        )}
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ts-list-open"
          title="Open"
          aria-label={`Open ${project.name} in a new tab`}
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </motion.div>
  );
}
