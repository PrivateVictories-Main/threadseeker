"use client";

import { useUnifiedAI } from "@/contexts/UnifiedAIContext";
import { Progress } from "@/components/ui/progress";
import { PROVIDER_CONFIGS } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

export function EnhancedStatusPill() {
  const { webllm, aiConfig, isReady } = useUnifiedAI();
  
  const providerConfig = PROVIDER_CONFIGS[aiConfig.provider];
  
  const getStatusConfig = () => {
    if (aiConfig.provider === "webllm") {
      switch (webllm.status) {
        case "idle":
          return {
            icon: "⚪️",
            text: "AI Idle",
            className: "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 cursor-pointer",
            showProgress: false,
          };
        case "checking":
          return {
            icon: "🔄",
            text: "Checking...",
            className: "bg-slate-800/50 text-slate-300",
            showProgress: false,
          };
        case "downloading":
          return {
            icon: "⬇️",
            text: `Downloading ${Math.round(webllm.progress * 100)}%`,
            className: "bg-slate-800/50 text-slate-300",
            showProgress: true,
          };
        case "ready":
          return {
            icon: providerConfig.icon,
            text: `${providerConfig.name} Ready`,
            className: "bg-slate-800/50 text-slate-300",
            showProgress: false,
          };
        case "error":
          return {
            icon: "🔴",
            text: "AI Error",
            className: "bg-slate-800/50 text-slate-400",
            showProgress: false,
          };
        case "unsupported":
          return {
            icon: "⚠️",
            text: "WebGPU Unsupported",
            className: "bg-slate-800/50 text-slate-400",
            showProgress: false,
          };
      }
    } else {
      // External API provider
      return {
        icon: providerConfig.icon,
        text: isReady ? `${providerConfig.name} Ready` : `${providerConfig.name} (No Key)`,
        className: isReady 
          ? "bg-slate-800/50 text-slate-300" 
          : "bg-slate-800/50 text-slate-400 cursor-pointer",
        showProgress: false,
      };
    }
  };

  const config = getStatusConfig();

  const handleClick = () => {
    if (aiConfig.provider === "webllm" && webllm.status === "idle") {
      webllm.initializeModel();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 backdrop-blur-sm border border-slate-700/50",
        config.className
      )}
      onClick={handleClick}
      role={config.className.includes("cursor-pointer") ? "button" : undefined}
      tabIndex={config.className.includes("cursor-pointer") ? 0 : undefined}
    >
      <span className="text-sm">{config.icon}</span>
      <span className="whitespace-nowrap">{config.text}</span>
      {config.showProgress && (
        <div className="w-16 ml-2">
          <Progress value={webllm.progress * 100} className="h-1.5 bg-slate-700" />
        </div>
      )}
    </div>
  );
}

