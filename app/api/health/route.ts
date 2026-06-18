import { kvConfigured } from "@/lib/kv";

// Lightweight health check for external uptime monitors (UptimeRobot, Better
// Uptime, etc.). Reports whether the critical dependency (Groq) is configured
// and pings Upstash if it's set up. Never leaks secret values — only booleans.
//
// Returns 200 while the app can serve its core flow (Groq key present), 503 if
// the one hard dependency is missing. Optional deps (Upstash) report status but
// don't fail the check, since the app degrades gracefully without them.

export const dynamic = "force-dynamic";

async function pingUpstash(): Promise<"ok" | "error" | "unconfigured"> {
  if (!kvConfigured()) return "unconfigured";
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function GET() {
  const groq = !!process.env.GROQ_API_KEY;
  const github = !!process.env.GITHUB_TOKEN;
  const redis = await pingUpstash();

  const healthy = groq && redis !== "error";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks: {
        groq: groq ? "configured" : "missing",
        github: github ? "configured" : "unauthenticated",
        redis,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
