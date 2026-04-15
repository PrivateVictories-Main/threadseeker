"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { WorkerMessage, WorkerResponse } from "@/workers/webllm.worker";

export type AIStatus = 
  | "idle" 
  | "checking" 
  | "downloading" 
  | "ready" 
  | "error" 
  | "unsupported";

export interface UseWebLLMReturn {
  status: AIStatus;
  progress: number;
  progressText: string;
  error: string | null;
  isGenerating: boolean;
  initializeModel: () => void;
  chat: (
    messages: ChatCompletionMessageParam[],
    onToken: (token: string) => void
  ) => Promise<void>;
  abort: () => void;
}

const MODEL_ID = "Llama-3.1-8B-Instruct-q4f16_1-MLC";

export function useWebLLM(): UseWebLLMReturn {
  const [status, setStatus] = useState<AIStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const pendingChatRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
    onToken: (token: string) => void;
    requestId: string;
  } | null>(null);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleWorkerMessage = useCallback((event: MessageEvent<WorkerResponse>) => {
    const response = event.data;

    switch (response.type) {
      case "init-progress":
        setProgress(response.progress);
        setProgressText(response.text);
        setStatus("downloading");
        break;

      case "init-complete":
        setStatus("ready");
        setProgress(1);
        setProgressText("Model loaded");
        break;

      case "init-error":
        setStatus("error");
        setError(response.error);
        break;

      case "webgpu-unsupported":
        setStatus("unsupported");
        setError("WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.");
        break;

      case "chat-token":
        if (pendingChatRef.current?.requestId === response.requestId) {
          pendingChatRef.current.onToken(response.token);
        }
        break;

      case "chat-complete":
        if (pendingChatRef.current?.requestId === response.requestId) {
          pendingChatRef.current.resolve();
          pendingChatRef.current = null;
          setIsGenerating(false);
        }
        break;

      case "chat-error":
        if (pendingChatRef.current?.requestId === response.requestId) {
          pendingChatRef.current.reject(new Error(response.error));
          pendingChatRef.current = null;
          setIsGenerating(false);
        }
        break;
    }
  }, []);

  const initializeModel = useCallback(() => {
    if (workerRef.current) {
      return; // Already initialized or initializing
    }

    setStatus("checking");
    setError(null);

    try {
      // Create worker using URL import
      workerRef.current = new Worker(
        new URL("../workers/webllm.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.onmessage = handleWorkerMessage;
      workerRef.current.onerror = (e) => {
        setStatus("error");
        setError(`Worker error: ${e.message}`);
      };

      // Start initialization
      const initMessage: WorkerMessage = { type: "init", model: MODEL_ID };
      workerRef.current.postMessage(initMessage);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to create worker");
    }
  }, [handleWorkerMessage]);

  const chat = useCallback(
    async (
      messages: ChatCompletionMessageParam[],
      onToken: (token: string) => void
    ): Promise<void> => {
      if (!workerRef.current) {
        throw new Error("Worker not initialized");
      }

      if (status !== "ready") {
        throw new Error("Model not ready");
      }

      if (isGenerating) {
        throw new Error("Already generating");
      }

      setIsGenerating(true);

      const requestId = crypto.randomUUID();

      return new Promise((resolve, reject) => {
        pendingChatRef.current = { resolve, reject, onToken, requestId };

        const chatMessage: WorkerMessage = {
          type: "chat",
          messages,
          requestId,
        };
        workerRef.current!.postMessage(chatMessage);
      });
    },
    [status, isGenerating]
  );

  const abort = useCallback(() => {
    if (workerRef.current && isGenerating) {
      const abortMessage: WorkerMessage = { type: "abort" };
      workerRef.current.postMessage(abortMessage);
      setIsGenerating(false);
      if (pendingChatRef.current) {
        pendingChatRef.current.reject(new Error("Aborted"));
        pendingChatRef.current = null;
      }
    }
  }, [isGenerating]);

  return {
    status,
    progress,
    progressText,
    error,
    isGenerating,
    initializeModel,
    chat,
    abort,
  };
}



