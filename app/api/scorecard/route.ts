import { enforce } from "@/lib/rate-limit";
import { kvGetJSON, kvSetJSON, kvConfigured, shortId } from "@/lib/kv";
import type { Scorecard } from "@/lib/scorecard";

const CARD_TTL = 60 * 60 * 24 * 30; // 30 days

// Store a scorecard and return a short id for a shareable URL.
export async function POST(req: Request) {
  const limited = await enforce(req, "scorecard", 20);
  if (limited) return limited;

  if (!kvConfigured()) {
    // No storage — caller falls back to the self-contained ?d= base64 link.
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  let card: Scorecard;
  try {
    card = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const categoriesValid =
    card?.categories === undefined ||
    (Array.isArray(card.categories) &&
      card.categories.every((c) => c && typeof c.name === "string" && typeof c.score === "number"));
  if (!card?.owner || !card?.repo || !categoriesValid) {
    return Response.json({ error: "Invalid scorecard" }, { status: 400 });
  }

  const id = shortId();
  const ok = await kvSetJSON(`card:${id}`, card, CARD_TTL);
  if (!ok) return Response.json({ error: "storage_unavailable" }, { status: 503 });

  return Response.json({ id });
}

// Look up a stored scorecard by id.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const card = await kvGetJSON<Scorecard>(`card:${id}`);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(card);
}
