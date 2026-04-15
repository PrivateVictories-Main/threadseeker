/// <reference lib="webworker" />

import * as webllm from "@mlc-ai/web-llm";

let engine: webllm.MLCEngine | null = null;

export type WorkerMessage =
  | { type: "init"; model: string }
  | { type: "chat"; messages: webllm.ChatCompletionMessageParam[]; requestId: string }
  | { type: "abort" };

export type WorkerResponse =
  | { type: "init-progress"; progress: number; text: string }
  | { type: "init-complete" }
  | { type: "init-error"; error: string }
  | { type: "webgpu-unsupported" }
  | { type: "chat-token"; token: string; requestId: string }
  | { type: "chat-complete"; requestId: string }
  | { type: "chat-error"; error: string; requestId: string };

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init":
      await initializeEngine(message.model);
      break;
    case "chat":
      await handleChat(message.messages, message.requestId);
      break;
    case "abort":
      if (engine) {
        engine.interruptGenerate();
      }
      break;
  }
};

async function initializeEngine(model: string) {
  try {
    // Check WebGPU support
    if (!navigator.gpu) {
      self.postMessage({ type: "webgpu-unsupported" } as WorkerResponse);
      return;
    }

    // Initialize the engine with progress callback
    engine = new webllm.MLCEngine();
    
    await engine.reload(model, {
      initProgressCallback: (progress) => {
        self.postMessage({
          type: "init-progress",
          progress: progress.progress,
          text: progress.text,
        } as WorkerResponse);
      },
    });

    self.postMessage({ type: "init-complete" } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "init-error",
      error: error instanceof Error ? error.message : "Unknown error during initialization",
    } as WorkerResponse);
  }
}

async function handleChat(
  messages: webllm.ChatCompletionMessageParam[],
  requestId: string
) {
  if (!engine) {
    self.postMessage({
      type: "chat-error",
      error: "Engine not initialized",
      requestId,
    } as WorkerResponse);
    return;
  }

  try {
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        self.postMessage({
          type: "chat-token",
          token,
          requestId,
        } as WorkerResponse);
      }
    }

    self.postMessage({
      type: "chat-complete",
      requestId,
    } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "chat-error",
      error: error instanceof Error ? error.message : "Unknown error during chat",
      requestId,
    } as WorkerResponse);
  }
}



