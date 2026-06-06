import { kvGetJSON } from "./kv";
import { decodeScorecard, type Scorecard } from "./scorecard";

// Resolves a scorecard for the share page / OG image from either a short id
// (Upstash lookup) or the self-contained ?d= base64 token.
export async function loadScorecard(params: {
  id?: string;
  d?: string;
}): Promise<Scorecard | null> {
  if (params.id) return kvGetJSON<Scorecard>(`card:${params.id}`);
  if (params.d) return decodeScorecard(params.d);
  return null;
}
