"use client";

import { EnhancedStatusPill } from "./EnhancedStatusPill";
import { AIProviderSettings } from "./AIProviderSettings";
import { useUnifiedAI } from "@/contexts/UnifiedAIContext";
import { Github, Sparkles } from "lucide-react";

export function EnhancedNavbar() {
  const { aiConfig, setAIConfig } = useUnifiedAI();

  const handleProviderChange = (provider: any, model?: string, apiKey?: string) => {
    setAIConfig({ provider, model, apiKey });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-900/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">
              GitSeeker
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <EnhancedStatusPill />
            <AIProviderSettings
              currentProvider={aiConfig.provider}
              currentModel={aiConfig.model}
              onProviderChange={handleProviderChange}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

