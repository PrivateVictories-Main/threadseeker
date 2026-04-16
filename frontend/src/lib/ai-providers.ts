// Multi-provider AI: WebLLM (local), OpenAI, Anthropic, OpenRouter.

export type AIProvider = "webllm" | "openai" | "anthropic" | "openrouter";

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelOption {
  id: string;
  name: string;
  size?: string;
  price?: string;
  context?: number;
}

interface ProviderConfig {
  name: string;
  description: string;
  icon: string;
  requiresApiKey: boolean;
  defaultModels: ModelOption[];
  color: string;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  webllm: {
    name: "WebLLM (Free)",
    description: "Runs locally in your browser — 100% free, unlimited, private",
    icon: "🧠",
    requiresApiKey: false,
    defaultModels: [
      { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B (Recommended)", size: "~2GB" },
      { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", name: "Llama 3.1 8B (Powerful)", size: "~4.5GB" },
      { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", name: "Phi 3.5 Mini (Efficient)", size: "~2.5GB" },
      { id: "Qwen2.5-7B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 7B (Multilingual)", size: "~4GB" },
      { id: "gemma-2-2b-it-q4f16_1-MLC", name: "Gemma 2 2B (Lightweight)", size: "~1.5GB" },
      { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", name: "Mistral 7B (Balanced)", size: "~4GB" },
    ],
    color: "from-violet-500 to-fuchsia-500",
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4o and GPT-4 Turbo models — requires API key",
    icon: "🤖",
    requiresApiKey: true,
    defaultModels: [
      { id: "gpt-4o", name: "GPT-4o (Latest)", price: "$$$" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Cheap)", price: "$" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", price: "$$$" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", price: "$" },
    ],
    color: "from-green-500 to-emerald-500",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3.5 Sonnet and Claude 3 models — requires API key",
    icon: "🎭",
    requiresApiKey: true,
    defaultModels: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Latest)", price: "$$$" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Fast)", price: "$" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", price: "$$$" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (Cheap)", price: "$" },
    ],
    color: "from-orange-500 to-amber-500",
  },
  openrouter: {
    name: "OpenRouter",
    description: "Access to 100+ models through one API — requires key",
    icon: "🌐",
    requiresApiKey: true,
    defaultModels: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", price: "$$$" },
      { id: "openai/gpt-4o", name: "GPT-4o", price: "$$$" },
      { id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro", price: "$$" },
      { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", price: "$$" },
      { id: "mistralai/mixtral-8x7b-instruct", name: "Mixtral 8x7B", price: "$" },
      { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B (Cheap)", price: "$" },
    ],
    color: "from-blue-500 to-cyan-500",
  },
};

// ---- Model fetching ---------------------------------------------------------

export async function fetchLatestModels(provider: AIProvider, apiKey?: string): Promise<ModelOption[]> {
  const fallback = PROVIDER_CONFIGS[provider].defaultModels;
  try {
    switch (provider) {
      case "openai": {
        if (!apiKey) return fallback;
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return fallback;
        const data = await res.json();
        const models = (data.data || [])
          .filter((m: any) => m.id.includes("gpt"))
          .sort((a: any, b: any) => b.created - a.created)
          .map((m: any) => ({
            id: m.id,
            name: m.id.toUpperCase().replace(/-/g, " "),
            price: m.id.includes("gpt-4") ? "$$$" : m.id.includes("gpt-3.5") ? "$" : "$$",
          }));
        return models.length > 0 ? models : fallback;
      }

      case "openrouter": {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (!res.ok) return fallback;
        const data = await res.json();
        const models = (data.data || [])
          .filter((m: any) => !m.id.includes(":free") && !m.id.includes("extended"))
          .sort((a: any, b: any) => {
            const score = (m: any) =>
              (m.top_provider?.max_completion_tokens || 0) +
              (m.pricing?.prompt ? 1 / parseFloat(m.pricing.prompt) : 0);
            return score(b) - score(a);
          })
          .slice(0, 20)
          .map((m: any): ModelOption => {
            const p = parseFloat(m.pricing?.prompt || "0");
            return {
              id: m.id,
              name: m.name || m.id,
              price: p > 0.00001 ? "$$$" : p > 0.000001 ? "$$" : "$",
              context: m.context_length,
            };
          });
        return models.length > 0 ? models : fallback;
      }

      // WebLLM and Anthropic don't expose public model-list endpoints we trust.
      case "webllm":
      case "anthropic":
      default:
        return fallback;
    }
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    return fallback;
  }
}

// ---- Streaming: shared SSE reader -------------------------------------------

type SSEHandler = (data: string) => string | null; // returns token, or null if no token

async function streamSSE(response: Response, handler: SSEHandler, onToken: (token: string) => void): Promise<void> {
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      msg = err.error?.message || err.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep the last partial line for the next chunk

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") {
        if (payload === "[DONE]") return;
        continue;
      }
      const token = handler(payload);
      if (token) onToken(token);
    }
  }
}

// OpenAI-compatible SSE format (also used by OpenRouter).
const openAIHandler: SSEHandler = (data) => {
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
};

// Anthropic-specific SSE format.
const anthropicHandler: SSEHandler = (data) => {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === "content_block_delta") return parsed.delta?.text ?? null;
    return null;
  } catch {
    return null;
  }
};

// ---- Streaming: per-provider entrypoints ------------------------------------

export async function streamOpenAI(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
): Promise<void> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 2000 }),
  });
  return streamSSE(res, openAIHandler, onToken);
}

export async function streamAnthropic(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
): Promise<void> {
  const system = messages.find((m) => m.role === "system")?.content;
  const convo = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, messages: convo, system, stream: true, max_tokens: 2000, temperature: 0.7 }),
  });
  return streamSSE(res, anthropicHandler, onToken);
}

export async function streamOpenRouter(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
): Promise<void> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "ThreadSeeker",
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 2000 }),
  });
  return streamSSE(res, openAIHandler, onToken);
}

export async function streamAI(
  config: AIConfig,
  messages: AIMessage[],
  onToken: (token: string) => void,
  webllmChat?: (messages: any[], onToken: (token: string) => void) => Promise<void>,
): Promise<void> {
  switch (config.provider) {
    case "webllm":
      if (!webllmChat) throw new Error("WebLLM chat function not provided");
      return webllmChat(messages, onToken);
    case "openai":
      if (!config.apiKey) throw new Error("OpenAI API key required");
      return streamOpenAI(messages, config.apiKey, config.model || "gpt-4o-mini", onToken);
    case "anthropic":
      if (!config.apiKey) throw new Error("Anthropic API key required");
      return streamAnthropic(messages, config.apiKey, config.model || "claude-3-5-haiku-20241022", onToken);
    case "openrouter":
      if (!config.apiKey) throw new Error("OpenRouter API key required");
      return streamOpenRouter(messages, config.apiKey, config.model || "meta-llama/llama-3.1-8b-instruct", onToken);
  }
}

// ---- API key validation -----------------------------------------------------

export async function validateApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
  try {
    switch (provider) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        });
        // 200 = ok, 400 = auth worked but request was minimal; 401/403 = bad key.
        return res.ok || res.status === 400;
      }
      case "openrouter": {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return res.ok;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// ---- Config persistence -----------------------------------------------------

const STORAGE_KEYS = {
  PROVIDER: "threadseeker_ai_provider",
  MODEL: "threadseeker_ai_model",
  API_KEY_PREFIX: "threadseeker_api_key_",
  // Legacy keys (gitseeker_*) — migrated on first load.
  LEGACY_PROVIDER: "gitseeker_ai_provider",
  LEGACY_MODEL: "gitseeker_ai_model",
  LEGACY_API_KEY_PREFIX: "gitseeker_api_key_",
};

function migrateLegacyKeys(): void {
  if (typeof window === "undefined") return;
  const legacyProvider = localStorage.getItem(STORAGE_KEYS.LEGACY_PROVIDER);
  if (legacyProvider && !localStorage.getItem(STORAGE_KEYS.PROVIDER)) {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, legacyProvider);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_PROVIDER);
  }
  const legacyModel = localStorage.getItem(STORAGE_KEYS.LEGACY_MODEL);
  if (legacyModel && !localStorage.getItem(STORAGE_KEYS.MODEL)) {
    localStorage.setItem(STORAGE_KEYS.MODEL, legacyModel);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MODEL);
  }
  for (const provider of ["webllm", "openai", "anthropic", "openrouter"] as AIProvider[]) {
    const legacyKey = `${STORAGE_KEYS.LEGACY_API_KEY_PREFIX}${provider}`;
    const newKey = `${STORAGE_KEYS.API_KEY_PREFIX}${provider}`;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, legacyValue);
      localStorage.removeItem(legacyKey);
    }
  }
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.PROVIDER, config.provider);
  if (config.model) localStorage.setItem(STORAGE_KEYS.MODEL, config.model);
  if (config.apiKey) {
    localStorage.setItem(`${STORAGE_KEYS.API_KEY_PREFIX}${config.provider}`, config.apiKey);
  }
}

export function loadAIConfig(): AIConfig {
  if (typeof window === "undefined") {
    return { provider: "webllm", model: "Llama-3.2-3B-Instruct-q4f16_1-MLC" };
  }
  migrateLegacyKeys();
  const provider = (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider) || "webllm";
  const model = localStorage.getItem(STORAGE_KEYS.MODEL) || undefined;
  const apiKey = localStorage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider}`) || undefined;
  return { provider, model, apiKey };
}

export function clearApiKey(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider}`);
}
