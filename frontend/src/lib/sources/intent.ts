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
    /\b(github|clone|fork|open[- ]source|self[- ]hosted)\b/i,
    // Tool-shopping noun phrases: someone describing "a library to create
    // PDFs" or "a CLI that converts videos" is hunting for a PROJECT, even
    // though the description contains how_to/troubleshooting verbs. These
    // nouns vote project_search so verb hits inside the noun phrase don't
    // misroute paragraph queries toward Q&A sources.
    /\b(library|package|framework|plugin|extension|crate|gem|module|sdk|cli|app|tool|generator|runtime|engine|server|daemon|client|wrapper|parser|scraper|dashboard|bot)s?\b/i,
  ],
  how_to: [
    // Question-framing must LEAD the query ("how do I…"). Anchored to the
    // first ~30 chars: a paragraph describing a tool that happens to contain
    // "build"/"deploy" mid-sentence is shopping for a project, not a lesson.
    /^.{0,30}\bhow (to|do|can)\b/i,
    /^.{0,30}\b(guide|tutorial|learn|teach me)\b/i,
    /\b(step[- ]by[- ]step|getting started|walkthrough)\b/i,
  ],
  recommendation: [
    /\b(best|top|recommend|suggestion|should i|which|better)\b/i,
  ],
  comparison: [/\bvs\.?\b|\bversus\b/i, /\b(compare|comparison|difference)\b/i],
  troubleshooting: [
    // Anchored like how_to: "fix"/"problem" mid-paragraph usually describes
    // what a TOOL does ("fixes image metadata problems"), not a support ask.
    /^.{0,30}\b(error|issue|problem|bug|broken|not working|help|solve|fix)\b/i,
    /\b(stack ?trace|exception|crash(es|ing)?|fails? with)\b/i,
  ],
  model_search: [
    /\b(model|llm|transformer|neural network|ai model|ml model)\b/i,
    /\b(gpt|bert|llama|mistral|stable diffusion|clip)\b/i,
    /\b(hugging ?face|hf|pretrained)\b/i,
  ],
};

// Per-source ranking nudges by detected intent (multiplied by INTENT_SCALE in
// the ranker). Extended beyond github/reddit/huggingface to the sources that
// genuinely align with each intent — so a how-to lifts Q&A/blog sources and a
// model query lifts the ML-paper sources, not just the original three.
export const INTENT_WEIGHTS: Record<Intent, Record<string, number>> = {
  project_search: { github: 0.7, gitlab: 0.3, codeberg: 0.25, reddit: 0.2, huggingface: 0.1 },
  how_to: { stackoverflow: 0.45, reddit: 0.4, devto: 0.3, github: 0.25, huggingface: 0.1 },
  recommendation: { reddit: 0.5, lobsters: 0.3, github: 0.25, devto: 0.2, huggingface: 0.15 },
  comparison: { reddit: 0.45, devto: 0.3, stackoverflow: 0.3, github: 0.3, huggingface: 0.2 },
  troubleshooting: { stackoverflow: 0.6, reddit: 0.4, github: 0.2, lobsters: 0.15 },
  model_search: { huggingface: 0.7, paperswithcode: 0.3, arxiv: 0.25, github: 0.2 },
  general: { github: 0.4, reddit: 0.3, huggingface: 0.2, stackoverflow: 0.15 },
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
