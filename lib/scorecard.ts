import type { Debrief } from "./debrief";

// A compact, self-contained snapshot of an interview result. Encoded into the
// share URL so the scorecard page + its OG image need no database.
export interface Scorecard {
  owner: string;
  repo: string;
  score: number; // overall, 1-10
  verdict: string;
  categories: { name: string; score: number }[];
}

const MAX_VERDICT = 260;
const MAX_CATEGORIES = 6;

export function scorecardFromDebrief(
  owner: string,
  repo: string,
  debrief: Partial<Debrief>
): Scorecard {
  return {
    owner,
    repo,
    score: debrief.overallScore ?? 0,
    verdict: (debrief.verdict ?? "").slice(0, MAX_VERDICT),
    categories: (debrief.categories ?? [])
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({ name: c.category, score: c.score })),
  };
}

// ─── Compact wire shape (short keys keep the URL short) ───────────────
interface Compact {
  o: string;
  r: string;
  s: number;
  v: string;
  c: [string, number][];
}

function toCompact(s: Scorecard): Compact {
  return { o: s.owner, r: s.repo, s: s.score, v: s.verdict, c: s.categories.map((c) => [c.name, c.score]) };
}

function fromCompact(c: Compact): Scorecard {
  return {
    owner: String(c.o ?? ""),
    repo: String(c.r ?? ""),
    score: Number(c.s ?? 0),
    verdict: String(c.v ?? ""),
    categories: Array.isArray(c.c)
      ? c.c.map(([name, score]) => ({ name: String(name), score: Number(score) }))
      : [],
  };
}

// ─── URL-safe base64 (isomorphic: works in browser + Node/edge) ───────
export function encodeScorecard(data: Scorecard): string {
  const json = JSON.stringify(toCompact(data));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeScorecard(token: string): Scorecard | null {
  try {
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return fromCompact(JSON.parse(json) as Compact);
  } catch {
    return null;
  }
}

export function verdictLabel(score: number): string {
  if (score >= 9) return "Aced the grilling";
  if (score >= 7) return "Survived the grilling";
  if (score >= 5) return "Scraped through";
  if (score >= 3) return "Got grilled";
  return "Got torched";
}
