// Iter-21 / Overhaul G — right-side detail drawer.
//
// Replaces the in-place card expansion (ExpandedDetail) with a Spotify
// macOS-style slide-in panel from the right edge of the viewport. The
// card grid stays uniformly compact / scannable while researchers can
// still pull deep metadata into view on demand.
//
// Behavior:
//   - Triggered by a "Details" button on the card (or by clicking the
//     card title in a future iteration).
//   - 480px wide on desktop, full-width on mobile.
//   - Backdrop dim 0.40 with backdrop-blur(8px); click to close.
//   - Esc closes.
//   - Body scroll locked while open.
//
// Sections mirror the ExpandedDetail layout — README excerpt, language
// breakdown, releases, top comments, related sources, quick actions —
// but with proper section spacing for the vertical column layout.

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import type { UnifiedProject } from "@/lib/sources/types";
import { fetchReadmeExcerpt, supportsReadme } from "@/lib/readme";
import { ghFetch } from "@/lib/github";
import { LanguageBar } from "./LanguageBar";
import { CardMedia } from "./CardMedia";
import { SourceBadge } from "./SourceBadge";
import { quickActionsForProject, formatRelativeShort, openLabelForSource } from "./helpers";
import { drawerSurface, modalBackdrop } from "@/lib/motion";
import { safeHref } from "@/lib/utils";

interface Props {
  project: UnifiedProject | null;
  open: boolean;
  onClose: () => void;
}

export function DetailDrawer({ project, open, onClose }: Props) {
  const [readmeExcerpt, setReadmeExcerpt] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [langBreakdown, setLangBreakdown] = useState<
    Record<string, number> | undefined
  >(undefined);

  // Reset README + language state when the drawer's project changes — drawer is
  // a singleton at the page level, so opening a second card after closing the
  // first must replay the lazy fetches.
  useEffect(() => {
    if (!project) return;
    setReadmeExcerpt(project.readmeExcerpt ?? null);
    setReadmeLoading(false);
    setLangBreakdown(project.languageBreakdown);
  }, [project?.id, project]);

  // Lazy, real GitHub language breakdown — one /languages call when the drawer
  // opens for a GitHub repo, so "Languages" shows the actual byte-share tech
  // composition instead of a single fallback "100%" segment.
  useEffect(() => {
    if (!open || !project || project.source !== "github") return;
    if (!project.fullName.includes("/") || langBreakdown) return;
    let cancelled = false;
    ghFetch(`https://api.github.com/repos/${project.fullName}/languages`)
      .then((r) => (r && r.ok ? r.json() : null))
      .then((data: Record<string, number> | null) => {
        if (cancelled || !data || typeof data !== "object") return;
        const total = Object.values(data).reduce(
          (s, v) => s + (typeof v === "number" ? v : 0),
          0,
        );
        if (total <= 0) return;
        const pct: Record<string, number> = {};
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === "number") pct[k] = (v / total) * 100;
        }
        setLangBreakdown(pct);
      })
      .catch(() => {
        /* network/cors/rate-limit — keep the single-language fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [open, project, langBreakdown]);

  // Lazy README fetch — only when drawer actually opens with a github/
  // codeberg project, only once per drawer-open cycle.
  useEffect(() => {
    if (!open || !project) return;
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
        /* network/cors — silently ignore */
      })
      .finally(() => {
        if (!cancelled) setReadmeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project, readmeExcerpt]);

  // Esc to close + body scroll lock when open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const releases = project?.releases ?? [];
  const topComments = project?.topComments ?? [];
  const related = project?.relatedSources ?? [];
  const quickActions = project ? quickActionsForProject(project) : [];

  const subline = project
    ? project.fullName !== project.name
      ? project.fullName
      : project.author?.name
        ? `by ${project.author.name}`
        : ""
    : "";

  const openLabel = project ? openLabelForSource(project.source) : "Open";

  return (
    <AnimatePresence>
      {open && project && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="ts-drawer-backdrop"
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden
          />

          {/* Surface */}
          <motion.aside
            key="surface"
            className="ts-drawer glass-strong"
            variants={drawerSurface}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={`Project details for ${project.name}`}
          >
            {/* COVER — same rich showcase header as the card */}
            <CardMedia
              source={project.source}
              fullName={project.fullName}
              language={project.language}
            />

            {/* HEADER */}
            <header className="ts-drawer-header">
              <div className="ts-drawer-header-row">
                <SourceBadge source={project.source} />
                <button
                  type="button"
                  className="ts-drawer-close"
                  onClick={onClose}
                  aria-label="Close details"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>
              <div className="ts-drawer-title-block">
                {project.author?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.author.avatar}
                    alt=""
                    className="ts-drawer-avatar"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <div className="ts-drawer-title-text">
                  <h2 className="ts-drawer-title">{project.name}</h2>
                  {subline && <p className="ts-drawer-subline">{subline}</p>}
                </div>
              </div>
              {project.description && (
                <p className="ts-drawer-desc">{project.description}</p>
              )}
            </header>

            {/* SCROLL CONTENT */}
            <div className="ts-drawer-scroll">
              {/* README */}
              {(readmeExcerpt || readmeLoading) && (
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">README</h3>
                  {readmeLoading && !readmeExcerpt && (
                    <p className="ts-drawer-muted">Fetching README…</p>
                  )}
                  {readmeExcerpt && (
                    <p className="ts-drawer-readme">
                      {readmeExcerpt.slice(0, 1200)}
                      {readmeExcerpt.length > 1200 && "…"}
                    </p>
                  )}
                </section>
              )}

              {/* Language breakdown */}
              {(langBreakdown || project.languageBreakdown || project.language) && (
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">Languages</h3>
                  <LanguageBar
                    breakdown={langBreakdown ?? project.languageBreakdown}
                    fallbackLanguage={project.language}
                  />
                </section>
              )}

              {/* Releases */}
              {releases.length > 0 && (
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">Recent releases</h3>
                  <ul className="ts-drawer-releases">
                    {releases.slice(0, 5).map((r) => (
                      <li key={r.version} className="ts-drawer-release">
                        <span className="ts-drawer-release-v">{r.version}</span>
                        <span className="ts-drawer-release-date">
                          {formatRelativeShort(r.date)}
                        </span>
                        {r.url && (
                          <a
                            className="ts-drawer-release-link"
                            href={safeHref(r.url)}
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

              {/* Top comments */}
              {topComments.length > 0 && (
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">Top comments</h3>
                  <ul className="ts-drawer-comments">
                    {topComments.slice(0, 4).map((c, i) => (
                      <li key={i} className="ts-drawer-comment">
                        <div className="ts-drawer-comment-meta">
                          <span className="ts-drawer-comment-author">{c.author}</span>
                          {typeof c.score === "number" && (
                            <span className="ts-drawer-comment-score">▲ {c.score}</span>
                          )}
                        </div>
                        <p className="ts-drawer-comment-body">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Related */}
              {related.length > 0 && (
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">Also on</h3>
                  <div className="ts-drawer-related">
                    {related.map((r) => (
                      <a
                        key={`${r.source}-${r.fullName}`}
                        href={safeHref(r.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`ts-source ts-source-${r.source} ts-drawer-related-chip`}
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
                <section className="ts-drawer-section">
                  <h3 className="ts-drawer-h">Quick actions</h3>
                  <div className="ts-drawer-quick">
                    {quickActions.map((a) => (
                      <a
                        key={a.label}
                        href={safeHref(a.href)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ts-drawer-qa"
                        title={a.title}
                      >
                        {a.label}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* FOOTER — primary CTA */}
            <footer className="ts-drawer-footer">
              <a
                className="btn btn-primary ts-drawer-cta"
                href={safeHref(project.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {openLabel}
                <ExternalLink className="w-4 h-4 ml-1" aria-hidden />
              </a>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
