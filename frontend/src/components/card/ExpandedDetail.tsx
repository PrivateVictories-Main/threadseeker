// Iter-20 / Overhaul F — in-place expansion panel for UnifiedProjectCard.
//
// Contract:
//   - Parent passes the project + an `open` flag and a setter.
//   - Component renders a motion.div that animates open/closed via
//     framer-motion's height/opacity. Layout transitions on the
//     enclosing AnimatedCard handle the grid reflow.
//   - When `open` flips to true and source supports a README excerpt,
//     this component fires a one-shot fetch via lib/readme.ts and
//     displays the result. Failures are silent (section just hides).
//
// Sections (each renders only when its data is present):
//   1. README excerpt (lazy-fetched on first open, github/codeberg only)
//   2. Language breakdown (LanguageBar — falls back to fallbackLanguage)
//   3. Recent activity sparkline + summary line
//   4. Recent releases (last 3, version + date)
//   5. Maintainer / author bio
//   6. Top comments (HN/Reddit/SO)
//   7. Related sources chips
//   8. Quick-action row

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnifiedProject } from "@/lib/sources/types";
import { fetchReadmeExcerpt, supportsReadme } from "@/lib/readme";
import { LanguageBar } from "./LanguageBar";
import { Sparkline } from "./Sparkline";
import { quickActionsForProject, formatRelativeShort } from "./helpers";

interface Props {
  project: UnifiedProject;
  open: boolean;
  /** Allow the parent to seed the readmeExcerpt cache (e.g. when
   * pre-fetched). When undefined the component fetches lazily on open. */
  reduceMotion?: boolean;
}

export function ExpandedDetail({ project, open, reduceMotion }: Props) {
  const [readmeExcerpt, setReadmeExcerpt] = useState<string | null>(
    project.readmeExcerpt ?? null,
  );
  const [readmeLoading, setReadmeLoading] = useState(false);

  // Lazy README fetch — only when the panel actually opens, only once
  // per card lifetime, only for sources that expose a readme endpoint.
  useEffect(() => {
    if (!open) return;
    if (readmeExcerpt) return;
    if (!supportsReadme(project.source)) return;
    let cancelled = false;
    setReadmeLoading(true);
    fetchReadmeExcerpt(project.source, project.fullName)
      .then((text) => {
        if (cancelled) return;
        setReadmeExcerpt(text);
      })
      .catch(() => {
        /* network/cors — silently ignore; section just stays hidden */
      })
      .finally(() => {
        if (!cancelled) setReadmeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project.source, project.fullName, readmeExcerpt]);

  const releases = project.releases ?? [];
  const topComments = project.topComments ?? [];
  const related = project.relatedSources ?? [];
  const quickActions = quickActionsForProject(project);
  const sparklineValues = (() => {
    // Reserved slot — currently no adapter ships per-week commit
    // counts. Keep the component wired so a future enrichment can
    // light it up without a code change here.
    if (project.commitsLastMonth && project.commitsLastMonth > 0) {
      // Synthesize a single-bar series so the row reads as "live".
      // (Using only the real datum, not fabricating a trend.)
      return [project.commitsLastMonth];
    }
    return [];
  })();

  // Motion: collapsing height to 0 lets us defer rendering of inner
  // elements until they're useful. AnimatePresence keeps the unmount
  // animated.
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="expand"
          className="ts-expand"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="ts-expand-inner">
            {/* README */}
            {(readmeExcerpt || readmeLoading) && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// README</h4>
                {readmeLoading && !readmeExcerpt && (
                  <p className="ts-expand-loading">Fetching README…</p>
                )}
                {readmeExcerpt && (
                  <p className="ts-expand-readme">
                    {readmeExcerpt.slice(0, 600)}
                    {readmeExcerpt.length > 600 && "…"}
                  </p>
                )}
              </section>
            )}

            {/* Language breakdown */}
            {(project.languageBreakdown || project.language) && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// LANGUAGES</h4>
                <LanguageBar
                  breakdown={project.languageBreakdown}
                  fallbackLanguage={project.language}
                />
              </section>
            )}

            {/* Recent activity sparkline */}
            {sparklineValues.length > 0 && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// ACTIVITY</h4>
                <div className="ts-expand-row">
                  <Sparkline values={sparklineValues} />
                  <span className="ts-expand-row-text">
                    {project.commitsLastMonth} commits last month
                  </span>
                </div>
              </section>
            )}

            {/* Releases */}
            {releases.length > 0 && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// RECENT RELEASES</h4>
                <ul className="ts-expand-releases">
                  {releases.slice(0, 3).map((r) => (
                    <li key={r.version} className="ts-expand-release">
                      <span className="ts-expand-release-v">{r.version}</span>
                      <span className="ts-expand-release-date">
                        {formatRelativeShort(r.date)}
                      </span>
                      {r.url && (
                        <a
                          className="ts-expand-release-link"
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          notes →
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Maintainer */}
            {project.author?.name && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// MAINTAINER</h4>
                <div className="ts-expand-row">
                  {project.author.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.author.avatar}
                      alt=""
                      className="ts-expand-avatar"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="ts-expand-row-text">
                    <strong className="ts-expand-author">{project.author.name}</strong>
                  </span>
                </div>
              </section>
            )}

            {/* Top comments */}
            {topComments.length > 0 && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// TOP COMMENTS</h4>
                <ul className="ts-expand-comments">
                  {topComments.slice(0, 2).map((c, i) => (
                    <li key={i} className="ts-expand-comment">
                      <div className="ts-expand-comment-meta">
                        <span className="ts-expand-comment-author">{c.author}</span>
                        {typeof c.score === "number" && (
                          <span className="ts-expand-comment-score">▲ {c.score}</span>
                        )}
                      </div>
                      <p className="ts-expand-comment-body">{c.body}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Related sources */}
            {related.length > 0 && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// ALSO ON</h4>
                <div className="ts-expand-related">
                  {related.map((r) => (
                    <a
                      key={`${r.source}-${r.fullName}`}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`ts-source ts-source-${r.source} ts-expand-related-chip`}
                      title={r.fullName}
                    >
                      {r.source}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Quick actions */}
            {quickActions.length > 0 && (
              <section className="ts-expand-section">
                <h4 className="ts-expand-h">// QUICK ACTIONS</h4>
                <div className="ts-expand-quick-actions">
                  {quickActions.map((a) => (
                    <a
                      key={a.label}
                      href={a.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ts-expand-qa"
                      title={a.title}
                    >
                      {a.label}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
