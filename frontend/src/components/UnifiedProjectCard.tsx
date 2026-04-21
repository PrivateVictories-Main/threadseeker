"use client";

import { useEffect, useState } from "react";
import { UnifiedProject, getSourceConfig } from "@/lib/sources";
import {
  getProjectActions,
  getPrimaryAction,
  ProjectAction,
} from "@/lib/actions";
import { formatNumber, highlightQuery, timeAgo } from "@/lib/utils";
import {
  isBookmarked,
  toggleBookmark,
  emitBookmarksChanged,
  onBookmarksChanged,
} from "@/lib/bookmarks";
import { supportsReadme, fetchReadmeExcerpt } from "@/lib/readme";
import {
  Star,
  Download,
  ExternalLink,
  Copy,
  Terminal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface UnifiedProjectCardProps {
  project: UnifiedProject;
  query?: string;
  onTopicClick?: (topic: string) => void;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const runs = highlightQuery(text, query);
  return (
    <>
      {runs.map((run, i) =>
        run.match ? (
          <mark
            key={i}
            className="bg-amber-500/20 text-amber-200 rounded-sm px-0.5"
          >
            {run.text}
          </mark>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: NonNullable<UnifiedProject["sentiment"]>;
}) {
  const styles: Record<typeof sentiment, string> = {
    positive: "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20",
    negative: "text-rose-400/80 bg-rose-500/10 border-rose-500/20",
    mixed: "text-amber-400/80 bg-amber-500/10 border-amber-500/20",
    neutral: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wide ${styles[sentiment]}`}
    >
      {sentiment}
    </span>
  );
}

export function UnifiedProjectCard({ project, query = "", onTopicClick }: UnifiedProjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [readme, setReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const canPreview = supportsReadme(project.source);

  const handleTogglePreview = async () => {
    if (readmeOpen) {
      setReadmeOpen(false);
      return;
    }
    setReadmeOpen(true);
    if (readme === null && !readmeLoading) {
      setReadmeLoading(true);
      try {
        const text = await fetchReadmeExcerpt(project.source, project.fullName);
        setReadme(text || "");
      } finally {
        setReadmeLoading(false);
      }
    }
  };

  // Hydrate bookmark state after mount — reading localStorage at render time
  // would break SSR for the static export.
  useEffect(() => {
    setPinned(isBookmarked(project.id));
    return onBookmarksChanged(() => setPinned(isBookmarked(project.id)));
  }, [project.id]);

  const handleTogglePin = () => {
    toggleBookmark(project);
    emitBookmarksChanged();
    const nowPinned = !pinned;
    setPinned(nowPinned);
    toast.success(nowPinned ? "Saved" : "Removed from saved");
  };

  const sourceConfig = getSourceConfig(project.source);
  const allActions = getProjectActions(project);
  const primaryAction = getPrimaryAction(project);
  const installActions = allActions.filter((a) => a.kind !== "visit");
  const THREAD_SOURCES = new Set([
    "reddit",
    "hackernews",
    "lobsters",
    "stackoverflow",
    "devto",
    "paperswithcode",
    "arxiv",
  ]);
  const isThread = THREAD_SOURCES.has(project.source);

  const copyCommand = (action: ProjectAction) => {
    navigator.clipboard.writeText(action.command);
    toast.success(`Copied: ${action.command}`);
  };

  return (
    <div className="group rounded-xl border border-slate-800/50 bg-slate-950/40 hover:border-slate-700/50 transition-colors overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-0">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {project.author.avatar ? (
            <img
              src={project.author.avatar}
              alt=""
              className="w-10 h-10 rounded-lg border border-slate-800/50 bg-slate-900 object-cover flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg border border-slate-800/50 bg-slate-900 flex items-center justify-center flex-shrink-0">
              <span className="text-slate-500 font-medium text-sm">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-slate-200 truncate">
                <Highlighted text={project.name} query={query} />
              </h3>
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                {sourceConfig.icon} {sourceConfig.name}
              </span>
            </div>
            <p className="text-xs text-slate-600 truncate">
              {project.author.name}
            </p>
          </div>

          <button
            onClick={handleTogglePin}
            aria-label={pinned ? "Remove from saved" : "Save for later"}
            title={pinned ? "Saved — click to remove" : "Save for later"}
            className={`flex-shrink-0 p-1.5 rounded-md transition-colors border ${
              pinned
                ? "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
                : "text-slate-600 border-slate-800/40 hover:text-slate-300 hover:border-slate-700/60 opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            {pinned ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pt-2 pb-3">
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {project.description ? (
            <Highlighted text={project.description} query={query} />
          ) : (
            "No description"
          )}
        </p>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3 flex items-center gap-3 text-[11px] text-slate-600">
        {isThread ? (
          <>
            {project.stars > 0 && (
              <span className="flex items-center gap-1" title="Upvotes / points">
                <TrendingUp className="w-3 h-3" />
                {formatNumber(project.stars)}
              </span>
            )}
            {project.commentsCount !== undefined && project.commentsCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {formatNumber(project.commentsCount)}
              </span>
            )}
            {project.sentiment && project.sentiment !== "neutral" && (
              <SentimentBadge sentiment={project.sentiment} />
            )}
            {project.updatedAt && (
              <span className="ml-auto">{timeAgo(project.updatedAt)}</span>
            )}
          </>
        ) : (
          <>
            {project.stars > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {formatNumber(project.stars)}
              </span>
            )}
            {project.downloads !== undefined && project.downloads > 0 && (
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {formatNumber(project.downloads)}
              </span>
            )}
            {project.language && <span>{project.language}</span>}
            {project.updatedAt && (
              <span className="ml-auto">{timeAgo(project.updatedAt)}</span>
            )}
          </>
        )}
      </div>

      {/* Thread warning banner */}
      {isThread && project.warning && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-amber-900/30 bg-amber-950/20 px-2.5 py-1.5 text-[10.5px] text-amber-300/90">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="leading-snug">{project.warning}</span>
        </div>
      )}

      {/* Topics */}
      {project.topics.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {project.topics.slice(0, 4).map((topic) =>
            onTopicClick ? (
              <button
                key={topic}
                onClick={() => onTopicClick(topic)}
                className="text-[10px] text-slate-500 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/40 hover:border-slate-700/60 rounded px-1.5 py-0.5 transition-colors"
                title={`Search for ${topic}`}
              >
                {topic}
              </button>
            ) : (
              <span
                key={topic}
                className="text-[10px] text-slate-500 bg-slate-900/60 border border-slate-800/40 rounded px-1.5 py-0.5"
              >
                {topic}
              </span>
            ),
          )}
          {project.topics.length > 4 && (
            <span className="text-[10px] text-slate-600">
              +{project.topics.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Related sources — same project on other platforms */}
      {project.relatedSources && project.relatedSources.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-600 uppercase tracking-wide">
              Also on
            </span>
            {project.relatedSources.map((rel) => {
              const cfg = getSourceConfig(rel.source);
              return (
                <a
                  key={`${rel.source}-${rel.url}`}
                  href={rel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${rel.fullName} on ${cfg.name}`}
                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/40 hover:border-slate-700/50 rounded-full px-1.5 py-0.5 transition-colors"
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-800/40 p-3 space-y-2">
        {/* Primary action row */}
        {isThread ? (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 text-xs text-slate-300 hover:text-slate-100 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/40 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
              <span className="truncate">Open thread on {sourceConfig.name}</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
          </a>
        ) : (
          <div className="flex items-center gap-2">
            {installActions.length > 0 ? (
              <>
                <button
                  onClick={() => copyCommand(primaryAction)}
                  className="flex-1 flex items-center gap-2 text-left text-xs text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800/40 rounded-lg px-3 py-2 transition-colors min-w-0"
                  title={primaryAction.command}
                >
                  <Terminal className="w-3.5 h-3.5 flex-shrink-0 text-slate-600" />
                  <code className="truncate font-mono text-[11px]">
                    {primaryAction.command}
                  </code>
                  <Copy className="w-3 h-3 flex-shrink-0 ml-auto text-slate-700" />
                </button>
                {installActions.length > 1 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="p-2 text-slate-600 hover:text-slate-400 border border-slate-800/40 rounded-lg hover:bg-slate-800/40 transition-colors"
                    title="More install commands"
                  >
                    {expanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </>
            ) : null}

            {canPreview && (
              <button
                onClick={handleTogglePreview}
                className={`p-2 border border-slate-800/40 rounded-lg hover:bg-slate-800/40 transition-colors ${
                  readmeOpen ? "text-slate-300 bg-slate-800/40" : "text-slate-600 hover:text-slate-400"
                }`}
                title={readmeOpen ? "Hide README" : "Preview README"}
              >
                {readmeLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-600 hover:text-slate-400 border border-slate-800/40 rounded-lg hover:bg-slate-800/40 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* README preview — plain-text excerpt, no markdown rendering to
            keep the bundle tiny and sidestep XSS. */}
        {readmeOpen && (
          <div className="rounded-lg bg-slate-900/60 border border-slate-800/40 p-3 max-h-64 overflow-y-auto">
            {readmeLoading ? (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading README…
              </div>
            ) : readme ? (
              <pre className="text-[11px] text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                {readme}
                {readme.length >= 1200 && (
                  <span className="text-slate-600">… (truncated)</span>
                )}
              </pre>
            ) : (
              <p className="text-[11px] text-slate-600">No README available.</p>
            )}
          </div>
        )}

        {/* Expanded install list */}
        {!isThread && expanded && installActions.length > 1 && (
          <div className="rounded-lg bg-slate-900/40 border border-slate-800/30 divide-y divide-slate-800/30">
            {installActions.map((action, idx) => (
              <button
                key={`${action.kind}-${idx}`}
                onClick={() => copyCommand(action)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/30 transition-colors"
              >
                <span className="text-[10px] text-slate-600 w-16 flex-shrink-0 font-medium">
                  {action.label}
                </span>
                <code className="text-[10px] text-slate-400 font-mono truncate flex-1">
                  {action.command.split("\n")[0]}
                </code>
                <Copy className="w-2.5 h-2.5 text-slate-700 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
