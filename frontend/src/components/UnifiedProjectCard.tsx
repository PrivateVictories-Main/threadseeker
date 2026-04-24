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
  avatarFallbackHue,
} from "./card/helpers";

interface Props {
  project: UnifiedProject;
  onToast?: (msg: string) => void;
  /** Wired from the page to turn a topic chip click into a new search. */
  onTopicClick?: (topic: string) => void;
}

export function UnifiedProjectCard({ project, onToast, onTopicClick }: Props) {
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

  // Source-aware version chip — shown only for package registries where the
  // upstream exposes a stable "latest version" string. Repos (github / gitlab
  // / codeberg) and model hubs (huggingface) have weaker version semantics
  // (tags, branches, commit shas) so we omit the chip there to avoid noise.
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

  // Sparse cards (no description AND no topics) get a lower min-height so a
  // row of them doesn't waste vertical space. auto-rows-fr still aligns all
  // cards in a row to the tallest, so grid geometry stays correct.
  const isSparse = !project.description && topics.length === 0;

  return (
    <AnimatedCard layoutId={project.id}>
      <article className={`ts-card glass${isSparse ? " ts-card-sparse" : ""}`}>
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
            // Plain colored circle fallback was identity-less. Rendering
            // the first letter of the project name gives the fallback
            // something to read as — matches GitHub/Gravatar default
            // avatars without requiring a network call. Hue is hashed
            // from project.id so a row of avatarless cards shows
            // subtle indigo→violet→sky variation instead of identical
            // gradient circles, without leaving the accent palette.
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

        {project.description && (
          <p className="ts-desc">{project.description}</p>
        )}

        {project.updatedAt && (() => {
          // Native title tooltip surfaces the exact ISO date on hover so a
          // user who hovers "updated 11 months ago" gets the precise
          // timestamp without having to dig — accessibility + utility
          // win. Falls back gracefully if the value isn't a valid date.
          // Skip the caption entirely when the upstream doesn't expose a
          // real timestamp (e.g. homebrew sets `updatedAt: ""`) — better
          // to omit than to lie with "just now".
          const iso = (() => {
            const d = new Date(project.updatedAt);
            return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
          })();
          const rel = formatRelativeTime(project.updatedAt);
          if (!rel) return null;
          return (
            <p className="ts-caption" title={iso || undefined}>
              updated {rel}
            </p>
          );
        })()}

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
