"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnifiedAI } from "@/contexts/UnifiedAIContext";
import { UnifiedProject, getProjectReadme, getSourceConfig } from "@/lib/sources";
import { getProjectActions, getPrimaryAction, ProjectAction } from "@/lib/actions";
import { formatNumber, timeAgo } from "@/lib/github";
import {
  Star,
  Download,
  ExternalLink,
  Zap,
  X,
  Loader2,
  Sparkles,
  Copy,
  GitBranch,
  FileDown,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

interface UnifiedProjectCardProps {
  project: UnifiedProject;
}

export function UnifiedProjectCard({ project }: UnifiedProjectCardProps) {
  const { chat, abort, isGenerating, isReady } = useUnifiedAI();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showAllCommands, setShowAllCommands] = useState(false);

  const sourceConfig = getSourceConfig(project.source);
  const allActions = getProjectActions(project);
  const primaryAction = getPrimaryAction(project);
  const hasInstallActions = allActions.some(
    (a) => a.kind === "install" || a.kind === "clone" || a.kind === "snippet"
  );

  const copyAction = (action: ProjectAction) => {
    navigator.clipboard.writeText(action.command);
    toast.success(`Copied: ${action.label}`);
  };

  const handleAnalyze = async () => {
    if (!isReady) {
      toast.error("AI is not ready. Please configure your AI provider in settings or initialize WebLLM.");
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysis("");

    try {
      const readme = await getProjectReadme(project);

      if (!readme) {
        setAnalysis("❌ Could not find documentation for this project.");
        setIsAnalyzing(false);
        return;
      }

      const truncatedReadme = readme.length > 6000 
        ? readme.substring(0, 6000) + "\n\n[Documentation truncated...]" 
        : readme;

      // Enhanced AI prompt for better accuracy
      const systemPrompt = `You are an expert software engineer and technical analyst. Your task is to analyze project documentation and provide actionable insights.

ANALYSIS GUIDELINES:
1. Focus on WHAT the project does (core purpose)
2. Highlight KEY features or unique capabilities
3. Explain WHO should use it and WHEN
4. Mention technical requirements or prerequisites if critical
5. Be concise but informative - aim for 3-4 bullet points
6. Use clear, professional language
7. If it's an AI model, mention the model type and use cases

Format your response as bullet points starting with • or -`;

      await chat(
        [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Analyze this ${sourceConfig.name} project: "${project.fullName}"

Project Description: ${project.description || "No description provided"}
Language/Framework: ${project.language || "Not specified"}
Topics/Tags: ${project.topics.join(", ") || "None"}

Documentation:
${truncatedReadme}

Provide a clear, actionable analysis in 3-4 bullet points.`,
          },
        ],
        (token) => {
          setAnalysis((prev) => (prev || "") + token);
        }
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Aborted") {
        setAnalysis((prev) => prev + "\n\n[Analysis stopped]");
      } else {
        toast.error("Failed to analyze project");
        console.error(error);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAbort = () => {
    abort();
    setIsAnalyzing(false);
  };

  const handleCopyPrimary = () => copyAction(primaryAction);

  return (
    <Card className="group relative overflow-hidden bg-slate-900/40 border-slate-800/60 hover:border-slate-700/60 transition-all duration-200">
      
      {/* Source indicator */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <Badge className="bg-slate-950/90 text-slate-500 border-slate-800/60 text-[10px] backdrop-blur-sm px-1.5 py-0.5">
          <span className="mr-0.5 text-[10px]">{sourceConfig.icon}</span>
          <span>{sourceConfig.name}</span>
        </Badge>
      </div>

      <CardHeader className="relative pb-2">
        <div className="flex items-start gap-3 pr-20">
          {/* Project Logo/Avatar */}
          <div className="relative flex-shrink-0">
            {project.author.avatar ? (
              <img
                src={project.author.avatar}
                alt={project.name}
                className="w-14 h-14 rounded-lg border border-slate-800/50 object-cover bg-slate-900"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="w-14 h-14 rounded-lg border border-slate-800/50 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center"
              style={{ display: project.author.avatar ? 'none' : 'flex' }}
            >
              <span className="text-slate-300 font-semibold text-xl">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          
          {/* Project Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-slate-100 truncate mb-0.5 leading-tight">
              {project.name}
            </h3>
            <p className="text-xs text-slate-600 truncate mb-1">by {project.author.name}</p>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <div className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-slate-700 text-slate-700" />
                <span>{formatNumber(project.stars)}</span>
              </div>
              {project.downloads !== undefined && project.downloads > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-0.5">
                    <Download className="w-2.5 h-2.5" />
                    <span>{formatNumber(project.downloads)}</span>
                  </div>
                </>
              )}
              {project.language && (
                <>
                  <span>•</span>
                  <span>{project.language}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3">
        {/* Description */}
        <div>
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
            {project.description || "No description available"}
          </p>
        </div>

        {/* Detailed Info Section */}
        <div className="space-y-2 pt-1 border-t border-slate-900/50">
          {/* Topics/Tags */}
          {project.topics && project.topics.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-600 mb-1 font-medium">Topics</p>
              <div className="flex flex-wrap gap-1">
                {project.topics.slice(0, 6).map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="bg-slate-950/60 text-slate-500 border-slate-900/60 text-[10px] px-1.5 py-0 font-normal"
                  >
                    {topic}
                  </Badge>
                ))}
                {project.topics.length > 6 && (
                  <Badge variant="secondary" className="bg-slate-950/60 text-slate-500 text-[10px] border-slate-900/60 px-1.5 py-0 font-normal">
                    +{project.topics.length - 6}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="space-y-1">
              <p className="text-slate-600 font-medium">Activity</p>
              <p className="text-slate-500">{timeAgo(project.updatedAt)}</p>
            </div>
            {project.license && (
              <div className="space-y-1">
                <p className="text-slate-600 font-medium">License</p>
                <p className="text-slate-500 truncate">{project.license}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-900/50">
          {!showAnalysis ? (
            <>
              {/* Primary Action - AI Analysis */}
              <Button
                onClick={handleAnalyze}
                disabled={!isReady}
                size="sm"
                className="w-full bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 h-9 text-xs justify-center"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                {isReady ? "Analyze with AI" : "AI Not Ready"}
              </Button>

              {/* Primary install/clone action + toggle for all commands + view */}
              {hasInstallActions ? (
                <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                  <Button
                    onClick={handleCopyPrimary}
                    variant="outline"
                    size="sm"
                    className="bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/40 transition-all duration-200 h-8 text-[11px] text-slate-400 hover:text-slate-300 px-2 min-w-0"
                    title={`Copy: ${primaryAction.command}`}
                  >
                    <Terminal className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{primaryAction.label}</span>
                  </Button>
                  <Button
                    onClick={() => setShowAllCommands((v) => !v)}
                    variant="outline"
                    size="sm"
                    className="bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/40 transition-all duration-200 h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                    title="All install commands"
                  >
                    {showAllCommands ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/40 transition-all duration-200 h-8 w-8 p-0 text-slate-400 hover:text-slate-300"
                    title="Open in new tab"
                  >
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/40 transition-all duration-200 h-8 text-[11px] text-slate-400 hover:text-slate-300"
                >
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </a>
                </Button>
              )}

              {/* All commands expanded list */}
              {showAllCommands && hasInstallActions && (
                <div className="rounded-lg bg-slate-950/60 border border-slate-900/60 p-2 space-y-1">
                  {allActions
                    .filter((a) => a.kind !== "visit")
                    .map((action, idx) => (
                      <button
                        key={`${action.kind}-${idx}`}
                        onClick={() => copyAction(action)}
                        className="group w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-900/60 transition-colors"
                        title={action.description || action.command}
                      >
                        <Terminal className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500 font-medium w-20 flex-shrink-0">
                          {action.label}
                        </span>
                        <code className="text-[10px] text-slate-400 font-mono truncate flex-1">
                          {action.command.split("\n")[0]}
                        </code>
                        <Copy className="w-2.5 h-2.5 text-slate-700 group-hover:text-slate-500 flex-shrink-0" />
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full space-y-2 border-t border-slate-900/50 pt-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-500 font-medium">AI Analysis</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (isAnalyzing) handleAbort();
                    setShowAnalysis(false);
                    setAnalysis(null);
                  }}
                  className="h-6 w-6 p-0 text-slate-600 hover:text-slate-400"
                  title="Close analysis"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-900/50 min-h-[100px]">
                {analysis ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {analysis}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-600 py-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Reading documentation and analyzing...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

