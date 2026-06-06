import React from "react";

// A tiny, dependency-free, per-line syntax highlighter. Not a full lexer — it
// colors comments, strings, numbers, and common keywords across the languages
// GitGrilled tends to see. Safe by construction: it builds React spans, so all
// text is escaped automatically (no dangerouslySetInnerHTML).

const KEYWORDS = new Set([
  // JS/TS
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "new", "class", "extends", "implements",
  "interface", "type", "enum", "import", "export", "from", "default", "async",
  "await", "yield", "try", "catch", "finally", "throw", "typeof", "instanceof",
  "in", "of", "void", "delete", "this", "super", "static", "public", "private",
  "protected", "readonly", "abstract", "namespace", "declare", "as", "satisfies",
  // Python
  "def", "lambda", "pass", "None", "True", "False", "self", "elif", "with",
  "and", "or", "not", "is", "global", "nonlocal", "raise", "except",
  // Go / Rust / others
  "func", "package", "nil", "fn", "mut", "pub", "struct", "impl", "match", "use",
  "trait", "module", "require", "end", "then",
]);

interface Tok {
  text: string;
  cls?: string;
}

// Ordered alternation: comment | string | number | identifier.
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)/g;

function tokenize(line: string): Tok[] {
  const toks: Tok[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) toks.push({ text: line.slice(last, idx) });
    if (m[1]) toks.push({ text: m[1], cls: "text-zinc-500 italic" });
    else if (m[2]) toks.push({ text: m[2], cls: "text-green-400" });
    else if (m[3]) toks.push({ text: m[3], cls: "text-amber-400" });
    else if (m[4]) {
      toks.push(
        KEYWORDS.has(m[4]) ? { text: m[4], cls: "text-purple-400" } : { text: m[4] }
      );
    }
    last = idx + m[0].length;
  }
  if (last < line.length) toks.push({ text: line.slice(last) });
  return toks;
}

export function highlightLine(line: string): React.ReactNode {
  if (!line) return " "; // keep empty lines visible
  return tokenize(line).map((t, i) =>
    t.cls ? (
      <span key={i} className={t.cls}>
        {t.text}
      </span>
    ) : (
      <React.Fragment key={i}>{t.text}</React.Fragment>
    )
  );
}
