// frontend/src/lib/sources/intent.ts
// Regex-based intent classifier. No LLM. Moved out of the deleted
// optimize-queries Pages Function.

export type Intent =
  | "project_search"
  | "how_to"
  | "recommendation"
  | "comparison"
  | "troubleshooting"
  | "model_search"
  | "general";

const INTENT_PATTERNS: Record<Exclude<Intent, "general">, RegExp[]> = {
  project_search: [
    /\b(project|repo|repository|code|implementation|example|template|boilerplate)\b/i,
    /\b(github|clone|fork|open[- ]source)\b/i,
  ],
  how_to: [
    /\bhow (to|do|can)\b/i,
    /\b(guide|tutorial|steps|learn|build|create|setup|deploy)\b/i,
  ],
  recommendation: [
    /\b(best|top|recommend|suggestion|should i|which|better|vs)\b/i,
  ],
  comparison: [/\bvs\.?\b|\bversus\b/i, /\b(compare|comparison|difference)\b/i],
  troubleshooting: [
    /\b(error|issue|problem|bug|fix|broken|not working|help|solve)\b/i,
  ],
  model_search: [
    /\b(model|llm|transformer|neural network|ai model|ml model)\b/i,
    /\b(gpt|bert|llama|mistral|stable diffusion|clip)\b/i,
    /\b(hugging ?face|hf|pretrained)\b/i,
  ],
};

const INTENT_WEIGHTS: Record<Intent, Record<string, number>> = {
  project_search: { github: 0.7, reddit: 0.2, huggingface: 0.1 },
  how_to: { reddit: 0.6, github: 0.3, huggingface: 0.1 },
  recommendation: { reddit: 0.6, github: 0.25, huggingface: 0.15 },
  comparison: { reddit: 0.5, github: 0.3, huggingface: 0.2 },
  troubleshooting: { reddit: 0.7, github: 0.2, huggingface: 0.1 },
  model_search: { huggingface: 0.7, github: 0.2, reddit: 0.1 },
  general: { github: 0.4, reddit: 0.4, huggingface: 0.2 },
};

export function classifyIntent(query: string): {
  intent: Intent;
  weights: Record<string, number>;
} {
  let best: Intent = "general";
  let bestScore = 0;
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as Array<
    [Exclude<Intent, "general">, RegExp[]]
  >) {
    const score = patterns.reduce((acc, p) => acc + (p.test(query) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return { intent: best, weights: INTENT_WEIGHTS[best] };
}
