import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { buildDebriefPrompt, DEBRIEF_SYSTEM_PROMPT, debriefSchema } from "@/lib/debrief";
import { enforce } from "@/lib/rate-limit";
import type { ProjectProfile } from "@/lib/profile";

const DEBRIEF_MODEL =
  process.env.GROQ_DEBRIEF_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const limited = await enforce(req, "debrief", 10);
  if (limited) return limited;

  const body = await req.json();
  const profile: ProjectProfile = body.profile;
  const conversation: ConversationTurn[] = body.conversation ?? [];
  const hintsUsed: number = typeof body.hintsUsed === "number" ? body.hintsUsed : 0;

  if (!profile || conversation.length === 0) {
    return Response.json({ error: "Missing profile or conversation" }, { status: 400 });
  }

  // Retry once — Groq's strict json_schema can occasionally reject a generation.
  const groq = createGroq();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: groq(DEBRIEF_MODEL),
        schema: debriefSchema,
        system: DEBRIEF_SYSTEM_PROMPT,
        prompt: buildDebriefPrompt(profile, conversation, hintsUsed),
      });
      return Response.json(object);
    } catch (err) {
      console.error(`[debrief] attempt ${attempt + 1}`, err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ error: "Debrief generation failed" }, { status: 502 });
}
