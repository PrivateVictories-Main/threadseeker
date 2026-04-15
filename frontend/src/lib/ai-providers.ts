// Multi-provider AI system supporting WebLLM, OpenAI, Anthropic, and OpenRouter

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

export interface AIStreamResponse {
  text: string;
  done: boolean;
}

// Provider configurations with fallback models
export const PROVIDER_CONFIGS = {
  webllm: {
    name: "WebLLM (Free)",
    description: "Runs locally in your browser - 100% free, unlimited, private",
    icon: "🧠",
    requiresApiKey: false,
    defaultModels: [
      { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B (Recommended - Fast)", size: "~2GB" },
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
    description: "GPT-4 and GPT-3.5 models - requires API key",
    icon: "🤖",
    requiresApiKey: true,
    defaultModels: [
      { id: "gpt-4-turbo-preview", name: "GPT-4 Turbo (Best)", price: "$$$" },
      { id: "gpt-4", name: "GPT-4", price: "$$$" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (Fast & Cheap)", price: "$" },
      { id: "gpt-3.5-turbo-16k", name: "GPT-3.5 Turbo 16K", price: "$$" },
    ],
    color: "from-green-500 to-emerald-500",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3 models - requires API key",
    icon: "🎭",
    requiresApiKey: true,
    defaultModels: [
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus (Best)", price: "$$$" },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet (Balanced)", price: "$$" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (Fast)", price: "$" },
    ],
    color: "from-orange-500 to-amber-500",
  },
  openrouter: {
    name: "OpenRouter",
    description: "Access to 100+ models - requires API key",
    icon: "🌐",
    requiresApiKey: true,
    defaultModels: [
      { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", price: "$$$" },
      { id: "openai/gpt-4-turbo-preview", name: "GPT-4 Turbo", price: "$$$" },
      { id: "google/gemini-pro", name: "Gemini Pro", price: "$$" },
      { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B", price: "$$" },
      { id: "mistralai/mixtral-8x7b-instruct", name: "Mixtral 8x7B", price: "$" },
      { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B (Cheap)", price: "$" },
    ],
    color: "from-blue-500 to-cyan-500",
  },
};

// Fetch latest models from each provider dynamically
export async function fetchLatestModels(provider: AIProvider, apiKey?: string): Promise<any[]> {
  try {
    switch (provider) {
      case "webllm": {
        // Fetch from MLC AI's prebuilt models list
        const response = await fetch(
          "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/prebuilt_models.json"
        );
        if (!response.ok) return PROVIDER_CONFIGS.webllm.defaultModels;
        
        const data = await response.json();
        return data.model_list?.map((model: any) => ({
          id: model.model_id,
          name: model.model_id.replace(/-q4f\d+_\d+-MLC$/, "").replace(/-/g, " "),
          size: model.model_lib_size || "Unknown",
        })) || PROVIDER_CONFIGS.webllm.defaultModels;
      }

      case "openai": {
        if (!apiKey) return PROVIDER_CONFIGS.openai.defaultModels;
        
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        
        if (!response.ok) return PROVIDER_CONFIGS.openai.defaultModels;
        
        const data = await response.json();
        const chatModels = data.data
          .filter((m: any) => m.id.includes("gpt"))
          .sort((a: any, b: any) => b.created - a.created)
          .map((m: any) => ({
            id: m.id,
            name: m.id.toUpperCase().replace(/-/g, " "),
            price: m.id.includes("gpt-4") ? "$$$" : m.id.includes("gpt-3.5") ? "$" : "$$",
          }));
        
        return chatModels.length > 0 ? chatModels : PROVIDER_CONFIGS.openai.defaultModels;
      }

      case "anthropic": {
        // Anthropic doesn't have a public models endpoint, return defaults with latest known models
        return [
          { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Latest)", price: "$$$" },
          { id: "claude-3-opus-20240229", name: "Claude 3 Opus", price: "$$$" },
          { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", price: "$$" },
          { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", price: "$" },
        ];
      }

      case "openrouter": {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        
        if (!response.ok) return PROVIDER_CONFIGS.openrouter.defaultModels;
        
        const data = await response.json();
        
        // Filter and sort by popularity/quality
        const models = data.data
          .filter((m: any) => !m.id.includes("free") && !m.id.includes("extended"))
          .sort((a: any, b: any) => {
            // Prioritize popular models
            const aScore = (a.top_provider?.max_completion_tokens || 0) + (a.pricing?.prompt ? 1 / parseFloat(a.pricing.prompt) : 0);
            const bScore = (b.top_provider?.max_completion_tokens || 0) + (b.pricing?.prompt ? 1 / parseFloat(b.pricing.prompt) : 0);
            return bScore - aScore;
          })
          .slice(0, 20)
          .map((m: any) => {
            const promptPrice = parseFloat(m.pricing?.prompt || "0");
            const priceLevel = promptPrice > 0.00001 ? "$$$" : promptPrice > 0.000001 ? "$$" : "$";
            
            return {
              id: m.id,
              name: m.name || m.id,
              price: priceLevel,
              context: m.context_length,
            };
          });
        
        return models.length > 0 ? models : PROVIDER_CONFIGS.openrouter.defaultModels;
      }

      default:
        return [];
    }
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    return PROVIDER_CONFIGS[provider].defaultModels;
  }
}

// OpenAI API
export async function streamOpenAI(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void
): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI API error");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices[0]?.delta?.content || "";
          if (token) onToken(token);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

// Anthropic API
export async function streamAnthropic(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void
): Promise<void> {
  // Convert messages format for Anthropic
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      messages: conversationMessages,
      system: systemMessage?.content,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Anthropic API error");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta") {
            const token = parsed.delta?.text || "";
            if (token) onToken(token);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

// OpenRouter API
export async function streamOpenRouter(
  messages: AIMessage[],
  apiKey: string,
  model: string,
  onToken: (token: string) => void
): Promise<void> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "GitSeeker",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenRouter API error");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No response body");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((line) => line.trim() !== "");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices[0]?.delta?.content || "";
          if (token) onToken(token);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

// Unified streaming function
export async function streamAI(
  config: AIConfig,
  messages: AIMessage[],
  onToken: (token: string) => void,
  webllmChat?: (messages: any[], onToken: (token: string) => void) => Promise<void>
): Promise<void> {
  switch (config.provider) {
    case "webllm":
      if (!webllmChat) throw new Error("WebLLM chat function not provided");
      return webllmChat(messages, onToken);

    case "openai":
      if (!config.apiKey) throw new Error("OpenAI API key required");
      return streamOpenAI(messages, config.apiKey, config.model || "gpt-3.5-turbo", onToken);

    case "anthropic":
      if (!config.apiKey) throw new Error("Anthropic API key required");
      return streamAnthropic(
        messages,
        config.apiKey,
        config.model || "claude-3-haiku-20240307",
        onToken
      );

    case "openrouter":
      if (!config.apiKey) throw new Error("OpenRouter API key required");
      return streamOpenRouter(
        messages,
        config.apiKey,
        config.model || "meta-llama/llama-3-8b-instruct",
        onToken
      );

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// Validate API key
export async function validateApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
  try {
    switch (provider) {
      case "openai": {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      }
      case "anthropic": {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1,
          }),
        });
        return response.ok || response.status === 400; // 400 is ok, means auth worked
      }
      case "openrouter": {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// Storage keys
const STORAGE_KEYS = {
  PROVIDER: "gitseeker_ai_provider",
  MODEL: "gitseeker_ai_model",
  API_KEY_PREFIX: "gitseeker_api_key_",
};

// Save config to localStorage
export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  
  localStorage.setItem(STORAGE_KEYS.PROVIDER, config.provider);
  if (config.model) {
    localStorage.setItem(STORAGE_KEYS.MODEL, config.model);
  }
  if (config.apiKey) {
    // Encrypt or warn user about storing API keys
    localStorage.setItem(`${STORAGE_KEYS.API_KEY_PREFIX}${config.provider}`, config.apiKey);
  }
}

// Load config from localStorage
export function loadAIConfig(): AIConfig {
  if (typeof window === "undefined") {
    return { provider: "webllm", model: "Llama-3.1-8B-Instruct-q4f16_1-MLC" };
  }

  const provider = (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider) || "webllm";
  const model = localStorage.getItem(STORAGE_KEYS.MODEL) || undefined;
  const apiKey = localStorage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider}`) || undefined;

  return { provider, model, apiKey };
}

// Clear API key
export function clearApiKey(provider: AIProvider): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${provider}`);
}

