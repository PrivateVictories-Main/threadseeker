"use client";

import type { UnifiedProject } from "@/lib/sources/types";
import { Highlight } from "./Highlight";
import { Avatar } from "./card/Avatar";
import { useCardTilt } from "./card/useCardTilt";
import { SourceBadge } from "./card/SourceBadge";
import { CardMedia } from "./card/CardMedia";
import { CardActions, type CopyItem } from "./card/CardActions";
import { PopularityBadge } from "./card/PopularityBadge";
import { CardStatRow } from "./card/CardStatRow";
import { IdentityRibbon } from "./card/IdentityRibbon";
import { AnimatedCard } from "./motion/AnimatedCard";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { bookmarkVariants } from "@/lib/motion";
import { useBookmark } from "@/lib/bookmarks";
import {
  copyItemsForSource,
  openLabelForSource,
  popularityClass,
  cardStatRow,
  formatCount,
  formatCountFull,
} from "./card/helpers";

interface Props {
  project: UnifiedProject;
  onToast?: (msg: string) => void;
  /** Wired from the page to turn a topic chip click into a new search. */
  onTopicClick?: (topic: string) => void;
  /** Open the right-side detail drawer for this project. Page owns the
   * drawer state so it's a singleton across the grid. */
  onOpenDetails?: (project: UnifiedProject) => void;
  /** Position in the result grid — drives subtle entry-direction variety. */
  index?: number;
  /** Extra outer-ring class (e.g. focus-ring on keyboard-focused card). */
  outerClassName?: string;
  /** Active free-text query — matched terms get <mark>-highlighted in
   *  name / description / topics so users see why a card matched. */
  query?: string;
}

// Iter-21 / Overhaul G — HF-clean compact card.
//
// Top-to-bottom structure (4-5 visual groups instead of the previous 7+):
//   1. Identity ribbon (3px source-tinted left edge)
//   2. Top row     — SourceBadge · PopularityBadge (text-only) · Bookmark
//   3. Identity    — 48px avatar + 20px name + version chip + author subline
//   4. Description — 2-line clamp (was 3)
//   5. Stat row    — single horizontal row of icon+number segments
//   6. Topics row  — up to 4 chips (smaller padding)
//   7. Action row  — Open + Copy + Details ↗ (drawer trigger)
//
// Removed from the prior Overhaul-A/F card:
//   - 5-cell mini-stat strip (consolidated into stat row)
//   - 3-cell metric grid (consolidated into stat row)
//   - mini-spec chip beneath title (info now in stat row)
//   - footer activity-dot row (info now in stat row)
//   - license tone helper as a separate pill (license now a stat-row segment)
//   - in-place expand toggle (replaced by Details ↗ → drawer)
export function UnifiedProjectCard({
  project,
  onToast,
  onTopicClick,
  onOpenDetails,
  index,
  outerClassName,
  query,
}: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
  const tilt = useCardTilt();
  const bookmarkControls = useAnimationControls();
  const pulseControls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  const copyItems: CopyItem[] = copyItemsForSource(project);
  const openLabel = openLabelForSource(project.source);

  const isRepo =
    project.source === "github" ||
    project.source === "gitlab" ||
    project.source === "codeberg";

  const topics = (project.topics ?? []).slice(0, 4);

  const avatar = project.author?.avatar;
  const subline = isRepo
    ? project.fullName.includes("/")
      ? `by ${project.fullName.split("/")[0]}`
      : ""
    : project.fullName !== project.name
      ? project.fullName
      : "";

  // Source-aware version chip.
  const VERSION_SOURCES = new Set<UnifiedProject["source"]>([
    "npm",
    "pypi",
    "crates",
    "rubygems",
    "packagist",
    "nuget",
    "maven",
    "jsr",
    "conda",
    "homebrew",
    "dockerhub",
  ]);
  const showVersion =
    !!project.version && VERSION_SOURCES.has(project.source);

  // Sparse cards (no description, no topics) get a lower min-height.
  const isSparse = !project.description && topics.length === 0;

  const popClass = popularityClass(project);
  const popReason = (() => {
    if (!popClass) return undefined;
    const stars = formatCount(project.stars || 0);
    const exact = project.stars > 0 ? ` (${formatCountFull(project.stars)})` : "";
    if (popClass === "hot") return `${stars}${exact} stars in under a month`;
    if (popClass === "trending") return `${stars}${exact} stars · trending`;
    if (popClass === "rising") return `${stars}${exact} stars · rising`;
    if (popClass === "new") return "Created recently";
    if (popClass === "established") return `${stars}${exact} stars · long-running`;
    return undefined;
  })();

  const statSegments = cardStatRow(project);

  return (
    <AnimatedCard
      layoutId={project.id}
      index={index}
      className={outerClassName}
      resultId={project.id}
      resultUrl={project.url}
    >
      <article
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className={`ts-card glass${isSparse ? " ts-card-sparse" : ""}`}
        data-source={project.source}
        data-pop={popClass ?? undefined}
      >
        {/* 3px source-tinted left edge */}
        <IdentityRibbon source={project.source} />

        {/* Hover scanline — 1px indigo sweep top→bottom on hover. CSS +
            reduced-motion handling already live in globals.css; this is the
            element that was missing. */}
        <span className="ts-scanline" aria-hidden />

        {/* Pointer-tracked spotlight (paired with the 3D tilt hook). */}
        <span className="ts-card-spotlight" aria-hidden />

        {/* Bookmark-pulse ring overlay */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[22px] border-[2px] border-transparent"
          initial={{ opacity: 0 }}
          animate={pulseControls}
        />

        {/* MEDIA — rich cover: GitHub OG banner, else a branded cover */}
        <CardMedia
          source={project.source}
          fullName={project.fullName}
          language={project.language}
        />

        {/* TOP ROW — source badge · popularity (text-only) · bookmark */}
        <div className="ts-top">
          <SourceBadge source={project.source} />
          {popClass && <PopularityBadge cls={popClass} reason={popReason} />}
          <motion.button
            className={`ts-bookmark ${isBookmarked ? "bookmarked" : ""}`}
            variants={bookmarkVariants}
            animate={bookmarkControls}
            onClick={() => {
              const willBeBookmarked = !isBookmarked;
              toggle();
              bookmarkControls
                .start("tapped")
                .then(() => bookmarkControls.start("rest"));
              const color = willBeBookmarked
                ? "rgba(99, 102, 241, 0.7)"
                : "rgba(148, 163, 184, 0.55)";
              if (reducedMotion) {
                pulseControls.set({ opacity: 1, borderColor: color });
                window.setTimeout(() => {
                  pulseControls.set({ opacity: 0 });
                }, 1500);
              } else {
                pulseControls
                  .start({
                    opacity: [0, 1, 0],
                    borderColor: [color, color, color],
                    transition: { duration: 0.6, ease: "easeOut" },
                  })
                  .catch(() => {
                    /* component unmounted mid-animation */
                  });
              }
            }}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {isBookmarked ? "♥" : "♡"}
          </motion.button>
        </div>

        {/* IDENTITY BLOCK — avatar + name (+version) + subline */}
        <div className="ts-title-row">
          <Avatar
            src={avatar}
            name={project.name}
            id={project.id}
            className="ts-avatar"
            fallbackClassName="ts-avatar-fallback"
          />
          <h3 className="ts-title">
            <span className="ts-title-main-row">
              <span className="ts-title-main">
              <Highlight text={project.name} query={query} />
            </span>
              {showVersion && (
                <span className="ts-version-chip" title={`Latest version ${project.version}`}>
                  v{project.version}
                </span>
              )}
            </span>
            {subline && <span className="ts-title-sub">{subline}</span>}
          </h3>
        </div>

        {/* DESCRIPTION — 2-line clamp (HF lean) */}
        {project.description ? (
          <p className="ts-desc">
            <Highlight text={project.description} query={query} />
          </p>
        ) : (
          <p className="ts-desc ts-desc-empty" aria-hidden>
            No description provided.
          </p>
        )}

        {/* STAT ROW — replaces metric grid + mini-strip + footer with one
            clean horizontal row of icon+number segments. */}
        <CardStatRow segments={statSegments} />

        {/* TOPICS — up to 4 clickable chips */}
        {topics.length > 0 && (
          <div className="ts-topics">
            {topics.map((t) =>
              onTopicClick ? (
                <button
                  key={t}
                  type="button"
                  className="topic-chip topic-chip-interactive"
                  onClick={() => onTopicClick(t)}
                  title={`Search for ${t}`}
                >
                  <Highlight text={t} query={query} />
                </button>
              ) : (
                <span key={t} className="topic-chip">
                  <Highlight text={t} query={query} />
                </span>
              ),
            )}
          </div>
        )}

        {/* ACTION ROW — Open / Copy / Details ↗ */}
        <CardActions
          url={project.url}
          copyItems={copyItems}
          openLabel={openLabel}
          onCopy={(text) => {
            onToast?.(`Copied: ${text.slice(0, 40)}`);
          }}
          onOpenDetails={onOpenDetails ? () => onOpenDetails(project) : undefined}
        />
      </article>
    </AnimatedCard>
  );
}
