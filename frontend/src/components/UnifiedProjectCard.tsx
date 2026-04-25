"use client";

import type { UnifiedProject } from "@/lib/sources/types";
import { SourceBadge } from "./card/SourceBadge";
import { CardActions, type CopyItem } from "./card/CardActions";
import { CardMetricGrid } from "./card/CardMetricGrid";
import { PopularityBadge } from "./card/PopularityBadge";
import { AnimatedCard } from "./motion/AnimatedCard";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { bookmarkVariants } from "@/lib/motion";
import { useBookmark } from "@/lib/bookmarks";
import {
  formatRelativeTime,
  licenseBucket,
  maintenanceState,
  copyItemsForSource,
  avatarFallbackHue,
  openLabelForSource,
  popularityClass,
  metricsForProject,
  formatCount,
} from "./card/helpers";

interface Props {
  project: UnifiedProject;
  onToast?: (msg: string) => void;
  /** Wired from the page to turn a topic chip click into a new search. */
  onTopicClick?: (topic: string) => void;
  /** Position in the result grid — drives subtle entry-direction variety. */
  index?: number;
  /**
   * Extra outer-ring class (e.g. focus-ring on keyboard-focused card).
   * Forwarded to the underlying AnimatedCard so we don't need a wrapping
   * motion.div in page.tsx — collapses the per-card motion-component
   * count from 2 → 1.
   */
  outerClassName?: string;
}

// Iter-15 overhaul — info-density card.
//
// Top-to-bottom structure:
//   1. Top row   — SourceBadge · PopularityBadge · Bookmark (push-right)
//   2. Title row — Avatar(44px) + h3 title + version chip + subline
//   3. Description — 3-line clamp (italic placeholder when absent)
//   4. Metric grid — 3 source-aware metric cells (Stars/Forks/Issues etc.)
//   5. Topics row — up to 4 clickable topic chips (refine search)
//   6. Footer row — activity dot + relative-time (left), language + license (right)
//   7. Action row — full-width primary CTA + ghost copy button (60/40 split)
//
// The card is significantly denser than the iter-14 version, but every
// sub-component drops itself when the corresponding upstream field is
// absent, so package cards (no language pill, no description) and
// thread cards (no version, no metric grid for github-style metrics)
// still look intentional rather than padded with placeholders.
export function UnifiedProjectCard({ project, onToast, onTopicClick, index, outerClassName }: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
  const bookmarkControls = useAnimationControls();
  // Bookmark-pulse ring overlay — see the original component history for
  // the rationale on the dual reduced-motion / animated branch.
  const pulseControls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  const copyItems: CopyItem[] = copyItemsForSource(project);
  const openLabel = openLabelForSource(project.source);

  const isRepo =
    project.source === "github" ||
    project.source === "gitlab" ||
    project.source === "codeberg";

  // Iter-15: 4 topics instead of 3 — gives the card a richer category
  // surface without overflowing on the standard 3-col grid.
  const topics = (project.topics ?? []).slice(0, 4);

  const avatar = project.author?.avatar;
  const subline = isRepo
    ? project.fullName.includes("/")
      ? `by ${project.fullName.split("/")[0]}`
      : ""
    : project.fullName !== project.name
      ? project.fullName
      : "";

  // Source-aware version chip — same source set as before. Repos and
  // model hubs lack stable "latest version" semantics so the chip
  // suppresses there.
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

  // Sparse cards (no description, no topics) get a lower min-height so a
  // row of them doesn't waste vertical space. auto-rows-fr still aligns
  // all cards in a row to the tallest, so grid geometry stays correct.
  const isSparse = !project.description && topics.length === 0;

  const popClass = popularityClass(project);
  const popReason = (() => {
    if (!popClass) return undefined;
    const stars = formatCount(project.stars || 0);
    if (popClass === "hot") return `${stars} stars in under a month`;
    if (popClass === "trending") return `${stars} stars · trending`;
    if (popClass === "rising") return `${stars} stars · rising`;
    if (popClass === "new") return "Created recently";
    if (popClass === "established") return `${stars} stars · long-running`;
    return undefined;
  })();

  const metrics = metricsForProject(project);
  const maint = maintenanceState(project.updatedAt);
  const license = licenseBucket(project.license);

  return (
    <AnimatedCard
      layoutId={project.id}
      index={index}
      className={outerClassName}
      resultId={project.id}
      resultUrl={project.url}
    >
      <article className={`ts-card glass${isSparse ? " ts-card-sparse" : ""}`}>
        {/* Bookmark-pulse ring */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] border-[2px] border-transparent"
          initial={{ opacity: 0 }}
          animate={pulseControls}
        />

        {/* TOP ROW — source · popularity-class · bookmark */}
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

        {/* TITLE ROW — avatar + name + version + subline */}
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
            <div
              className="ts-avatar ts-avatar-fallback"
              aria-hidden
              style={{ ["--ts-fallback-hue" as string]: avatarFallbackHue(project.id) }}
            >
              {project.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h3 className="ts-title">
            <span className="ts-title-main-row">
              <span className="ts-title-main">{project.name}</span>
              {showVersion && (
                <span className="ts-version-chip" title={`Latest version ${project.version}`}>
                  v{project.version}
                </span>
              )}
            </span>
            {subline && <span className="ts-title-sub">{subline}</span>}
          </h3>
        </div>

        {/* DESCRIPTION — 3-line clamp */}
        {project.description ? (
          <p className="ts-desc">{project.description}</p>
        ) : (
          <p className="ts-desc ts-desc-empty" aria-hidden>
            No description provided.
          </p>
        )}

        {/* METRIC GRID — source-aware 3-cell snapshot */}
        <CardMetricGrid cells={metrics} />

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
                  {t}
                </button>
              ) : (
                <span key={t} className="topic-chip">
                  {t}
                </span>
              ),
            )}
          </div>
        )}

        {/* FOOTER ROW — activity-dot + relative time (left), lang + license (right).
            mt-auto pushes this to sit just above the action row, regardless of
            how much vertical space the description / topics occupy. */}
        {(() => {
          const rel = formatRelativeTime(project.updatedAt);
          const isoTitle = (() => {
            const d = new Date(project.updatedAt);
            return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
          })();
          const showLeft = !!rel;
          const showLang = !!project.language;
          const showLicense = license && license !== "Unknown";
          if (!showLeft && !showLang && !showLicense) return null;
          return (
            <div className="ts-footer-row" style={{ marginTop: "auto" }}>
              <div className="ts-footer-left">
                {showLeft && (
                  <>
                    <span
                      className="ts-activity-dot"
                      data-state={maint}
                      aria-hidden
                    />
                    <span title={isoTitle || undefined}>updated {rel}</span>
                  </>
                )}
              </div>
              <div className="ts-footer-right">
                {showLang && (
                  <span className="pill pill-language">{project.language}</span>
                )}
                {showLicense && <span className="pill pill-license">{license}</span>}
              </div>
            </div>
          );
        })()}

        {/* ACTION ROW — primary CTA + ghost copy (60/40 split) */}
        <CardActions
          url={project.url}
          copyItems={copyItems}
          openLabel={openLabel}
          onCopy={(text) => {
            onToast?.(`Copied: ${text.slice(0, 40)}`);
          }}
        />
      </article>
    </AnimatedCard>
  );
}
