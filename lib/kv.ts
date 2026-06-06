// Minimal Upstash Redis key-value helpers (REST, no SDK dependency), used for
// caching generated profiles and storing scorecards behind short share URLs.
//
// When Upstash isn't configured, every operation degrades gracefully: reads
// return null and writes no-op, so the app still works (it just regenerates
// profiles and falls back to long base64 share links).

const url = () => process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvConfigured(): boolean {
  return !!(url() && token());
}

async function cmd(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${url()}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result: unknown }[];
  return data[0]?.result ?? null;
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  if (!kvConfigured()) return null;
  try {
    const raw = await cmd(["GET", key]);
    return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvSetJSON(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  if (!kvConfigured()) return false;
  try {
    await cmd(["SET", key, JSON.stringify(value), "EX", ttlSec]);
    return true;
  } catch {
    return false;
  }
}

// URL-safe-ish short id for share links.
export function shortId(bytes = 8): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}
