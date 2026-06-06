// Lightweight, zero-dependency rate limiter.
//
// If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, it uses Upstash
// Redis (distributed, correct across serverless instances) via the REST API.
// Otherwise it falls back to an in-memory fixed window — good enough for local
// dev and single-instance deployments, and it never throws.

export interface RateResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number; // ms until the window resets
}

// ─── In-memory fallback ──────────────────────────────────────────────
const memory = new Map<string, { count: number; reset: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();

  // Opportunistic prune so the map can't grow unbounded.
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.reset <= now) memory.delete(k);
  }

  const entry = memory.get(key);
  if (!entry || entry.reset <= now) {
    memory.set(key, { count: 1, reset: now + windowMs });
    return { success: true, limit, remaining: limit - 1, resetMs: windowMs };
  }
  entry.count++;
  return {
    success: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetMs: entry.reset - now,
  };
}

// ─── Upstash Redis (REST) ────────────────────────────────────────────
async function upstashLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"], // set TTL only on first hit of the window
      ["PTTL", key],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);

  const data = (await res.json()) as { result: number }[];
  const count = Number(data[0]?.result ?? 0);
  const ttl = Number(data[2]?.result ?? windowMs);
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetMs: ttl > 0 ? ttl : windowMs,
  };
}

const upstashConfigured = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  if (upstashConfigured()) {
    try {
      return await upstashLimit(key, limit, windowMs);
    } catch {
      // Never let a limiter outage take down the route — degrade to in-memory.
      return memoryLimit(key, limit, windowMs);
    }
  }
  return memoryLimit(key, limit, windowMs);
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function clientId(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anon";
}

const WINDOW_MS = 60_000;

/**
 * Enforce a per-client, per-route limit. Returns a 429 Response when exceeded,
 * or null when the request may proceed. `bodyShape` controls the JSON returned
 * so it matches what each route's client expects.
 */
export async function enforce(
  req: Request,
  route: string,
  limitPerMin: number,
  bodyShape: "code" | "error" = "error"
): Promise<Response | null> {
  const result = await rateLimit(`gg:${route}:${clientId(req)}`, limitPerMin, WINDOW_MS);
  if (result.success) return null;

  const retryAfter = Math.ceil(result.resetMs / 1000);
  const body =
    bodyShape === "code"
      ? { code: "RATE_LIMITED" }
      : { error: "RATE_LIMITED", message: "Too many requests — slow down a moment." };

  return Response.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limitPerMin),
      "X-RateLimit-Remaining": "0",
    },
  });
}
