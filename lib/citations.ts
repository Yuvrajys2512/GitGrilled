// Parses "path:line" code references (e.g. `lib/github.ts:142` or
// `app/api/analyze/route.ts:12-20`) out of the interviewer's messages so the UI
// can turn them into clickable, expandable code snippets.

export interface CitationToken {
  type: "cite";
  raw: string; // the full matched text (without surrounding backticks)
  path: string;
  line: number;
  endLine: number | null;
}
export interface TextToken {
  type: "text";
  value: string;
}
export type MessageToken = CitationToken | TextToken;

// path segments + a filename with an extension, then :line and optional -endLine.
const CITATION_RE =
  /((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?(?::\d+)?/g;

export function parseMessage(text: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_RE)) {
    const idx = match.index ?? 0;
    let start = idx;
    let end = idx + match[0].length;

    // Swallow surrounding backticks so we don't render stray ` around the chip.
    if (text[start - 1] === "`" && text[end] === "`") {
      start -= 1;
      end += 1;
    }

    if (start > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    tokens.push({
      type: "cite",
      raw: match[0],
      path: match[1],
      line: Number(match[2]),
      endLine: match[3] ? Number(match[3]) : null,
    });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
}

export function hasCitations(text: string): boolean {
  CITATION_RE.lastIndex = 0;
  return CITATION_RE.test(text);
}
