"use client";

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { useWebLLM, UseWebLLMReturn } from "@/hooks/useWebLLM";
import { AIProvider, AIConfig, AIMessage, streamAI, loadAIConfig, saveAIConfig } from "@/lib/ai-providers";

export interface UnifiedAIContextValue {
  // WebLLM specific
  webllm: UseWebLLMReturn;
  
  // Unified AI interface
  aiConfig: AIConfig;
  setAIConfig: (config: AIConfig) => void;
  chat: (messages: AIMessage[], onToken: (token: string) => void) => Promise<void>;
  isGenerating: boolean;
  abort: () => void;
  
  // Status for UI
  isReady: boolean;
  statusMessage: string;
}

const UnifiedAIContext = createContext<UnifiedAIContextValue | null>(null);

export function UnifiedAIProvider({ children }: { children: ReactNode }) {
  const webllm = useWebLLM();
  const [aiConfig, setAIConfigState] = useState<AIConfig>(() => loadAIConfig());
  const [isGenerating, setIsGenerating] = useState(false);

  // Load config on mount and auto-initialize WebLLM
  useEffect(() => {
    const config = loadAIConfig();
    setAIConfigState(config);
    
    // Auto-initialize WebLLM if it's the selected provider
    if (config.provider === "webllm" && webllm.status === "idle") {
      // Small delay to let the page load first
      setTimeout(() => {
        webllm.initializeModel();
      }, 1000);
    }
  }, []);

  const setAIConfig = useCallback((config: AIConfig) => {
    setAIConfigState(config);
    saveAIConfig(config);
  }, []);

  const chat = useCallback(
    async (messages: AIMessage[], onToken: (token: string) => void) => {
      setIsGenerating(true);
      try {
        if (aiConfig.provider === "webllm") {
          // Use WebLLM
          await webllm.chat(messages as any, onToken);
        } else {
          // Use external API
          await streamAI(
            aiConfig,
            messages,
            onToken,
            undefined
          );
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [aiConfig, webllm]
  );

  const abort = useCallback(() => {
    if (aiConfig.provider === "webllm") {
      webllm.abort();
    }
    setIsGenerating(false);
  }, [aiConfig.provider, webllm]);

  // Determine if AI is ready
  const isReady = aiConfig.provider === "webllm" 
    ? webllm.status === "ready"
    : Boolean(aiConfig.apiKey);

  // Status message for UI
  const statusMessage = aiConfig.provider === "webllm"
    ? webllm.progressText || "WebLLM"
    : `${aiConfig.provider.toUpperCase()} ${aiConfig.apiKey ? "Ready" : "API Key Required"}`;

  const value: UnifiedAIContextValue = {
    webllm,
    aiConfig,
    setAIConfig,
    chat,
    isGenerating: aiConfig.provider === "webllm" ? webllm.isGenerating : isGenerating,
    abort,
    isReady,
    statusMessage,
  };

  return (
    <UnifiedAIContext.Provider value={value}>
      {children}
    </UnifiedAIContext.Provider>
  );
}

export function useUnifiedAI(): UnifiedAIContextValue {
  const context = useContext(UnifiedAIContext);
  if (!context) {
    throw new Error("useUnifiedAI must be used within a UnifiedAIProvider");
  }
  return context;
}


