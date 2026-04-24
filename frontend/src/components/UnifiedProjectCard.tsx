"use client";

import type { UnifiedProject } from "@/lib/sources/types";
import { SourceBadge } from "./card/SourceBadge";
import { CardPills } from "./card/CardPills";
import { CardActions, type CopyItem } from "./card/CardActions";
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
  popularityForProject,
} from "./card/helpers";

interface Props {
  project: UnifiedProject;
  onToast?: (msg: string) => void;
  /** Wired from the page to turn a topic chip click into a new search. */
  onTopicClick?: (topic: string) => void;
  /** Position in the result grid — drives subtle entry-direction variety. */
  index?: number;
}

export function UnifiedProjectCard({ project, onToast, onTopicClick, index }: Props) {
  const { isBookmarked, toggle } = useBookmark(project);
  const bookmarkControls = useAnimationControls();
  // Per-card pulse-ring overlay triggered after a bookmark add/remove.
  // Indigo on add (delight), neutral slate on remove (acknowledged but
  // quieter). Renders as an absolutely-positioned sibling ring that
  // fades 0 → 1 → 0 over ~600ms — does NOT touch the card's existing
  // glass box-shadow / hover-lift, so we don't fight the .ts-card:hover
  // transform. Under reduced-motion the animated 0→1→0 cycle would
  // auto-collapse via the global MotionConfig provider, leaving no
  // visible affordance — so we branch on `useReducedMotion` and play a
  // static "hold-then-fade" instead so the user still gets a clear
  // "you did it" signal.
  const pulseControls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  // Source-aware popularity: threads (HN/Reddit/Lobsters) get an upvote
  // triangle + a comments glyph; everything else keeps the star or
  // download arrow. Pure-data swap — pills/layout unchanged.
  const popularity = popularityForProject(project);

  const copyItems: CopyItem[] = copyItemsForSource(project);
  const openLabel = openLabelForSource(project.source);

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
    <AnimatedCard layoutId={project.id} index={index}>
      <article className={`ts-card glass${isSparse ? " ts-card-sparse" : ""}`}>
        {/* Bookmark-pulse ring — absolutely positioned overlay so it
            fades over the card without disturbing the existing glass
            box-shadow or hover-lift. borderColor is animated to indigo
            on add and slate on remove. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[18px] border-[2px] border-transparent"
          initial={{ opacity: 0 }}
          animate={pulseControls}
        />
        <div className="ts-top">
          <SourceBadge source={project.source} />
          <motion.button
            className={`ts-bookmark ${isBookmarked ? "bookmarked" : ""}`}
            variants={bookmarkVariants}
            animate={bookmarkControls}
            onClick={() => {
              // Determine the post-toggle state from the current one —
              // useBookmark is sync, but reading the pre-toggle isBookmarked
              // + flipping gives us the correct after-state without an
              // extra render.
              const willBeBookmarked = !isBookmarked;
              toggle();
              bookmarkControls
                .start("tapped")
                .then(() => bookmarkControls.start("rest"));
              const color = willBeBookmarked
                ? "rgba(99, 102, 241, 0.7)"   // indigo-500/70
                : "rgba(148, 163, 184, 0.55)"; // slate-400/55
              if (reducedMotion) {
                // Static "you did it" — snap on for ~1.5s, then snap off.
                // No animated transition so prefers-reduced-motion users
                // still get a clear signal without any moving pixels.
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

        {project.description ? (
          <p className="ts-desc">{project.description}</p>
        ) : (
          // Subtle italic placeholder when the upstream doesn't ship a
          // description (common on obscure GitHub repos, AUR packages,
          // some HF models). Better than empty space because:
          //   - the card retains its 2-line vertical rhythm so a row of
          //     mixed-description cards aligns instead of stair-stepping
          //   - the user understands "this card has no description" vs
          //     "this card has a bug" — the absence is intentional
          // Tone: italic + faint slate, never reads as content.
          <p className="ts-desc ts-desc-empty" aria-hidden>
            No description provided.
          </p>
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
          openLabel={openLabel}
          onCopy={(text) => {
            onToast?.(`Copied: ${text.slice(0, 40)}`);
          }}
        />
      </article>
    </AnimatedCard>
  );
}
