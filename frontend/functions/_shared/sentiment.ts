// Lightweight regex-based sentiment analysis for Reddit thread comments.
// Ported from backend/search_logic.py — same patterns, same verdicts.

export type Sentiment = "positive" | "mixed" | "negative" | "neutral";

const NEGATIVE_PATTERNS: RegExp[] = [
  /\bdoesn'?t work\b/i,
  /\bbroken\b/i,
  /\bdeprecated\b/i,
  /\babandoned\b/i,
  /\bdon'?t use\b/i,
  /\bwaste of time\b/i,
  /\bterrible\b/i,
  /\bhorrible\b/i,
  /\bgarbage\b/i,
  /\buseless\b/i,
  /\bscam\b/i,
  /\bbug(?:gy|s)\b/i,
  /\bnot maintained\b/i,
  /\bno longer works\b/i,
  /\bdead project\b/i,
];

const POSITIVE_PATTERNS: RegExp[] = [
  /\bworks great\b/i,
  /\bhighly recommend\b/i,
  /\bamazing\b/i,
  /\bexcellent\b/i,
  /\bperfect\b/i,
  /\bawesome\b/i,
  /\blove (?:it|this)\b/i,
  /\bbest\b/i,
  /\bfantastic\b/i,
];

export function analyzeSentiment(
  text: string,
): { sentiment: Sentiment; warning: string | null } {
  const negMatches: string[] = [];
  for (const p of NEGATIVE_PATTERNS) {
    const m = text.match(p);
    if (m) negMatches.push(m[0]);
  }
  const posCount = POSITIVE_PATTERNS.reduce(
    (acc, p) => acc + (p.test(text) ? 1 : 0),
    0,
  );

  if (negMatches.length >= 2) {
    return {
      sentiment: "negative",
      warning: `Community concerns: ${negMatches.slice(0, 3).join(", ")}`,
    };
  }
  if (negMatches.length && posCount === 0) {
    return {
      sentiment: "mixed",
      warning: `Mixed feedback: ${negMatches[0]}`,
    };
  }
  if (posCount >= 2) {
    return { sentiment: "positive", warning: null };
  }
  return { sentiment: "neutral", warning: null };
}
