import { highlightQuery } from "@/lib/utils";

interface Props {
  /** The text to render (project name, description, topic, …). */
  text: string;
  /** The active free-text query. When absent/empty, renders plain text. */
  query?: string;
}

// Renders `text` with the user's query terms wrapped in <mark className="ts-mark">
// so every result card shows *why* it matched. Falls back to plain text when
// there's no query (landing rails, featured strip) or when nothing matches —
// so we never churn the DOM with no-op spans. Matching + escaping live in
// highlightQuery() (lib/utils.ts), which is Unicode-safe and regex-injection-safe.
export function Highlight({ text, query }: Props) {
  if (!query || !text) return <>{text}</>;
  const runs = highlightQuery(text, query);
  if (!runs.some((r) => r.match)) return <>{text}</>;
  return (
    <>
      {runs.map((run, i) =>
        run.match ? (
          <mark key={i} className="ts-mark">
            {run.text}
          </mark>
        ) : (
          run.text
        ),
      )}
    </>
  );
}
