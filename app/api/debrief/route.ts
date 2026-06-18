import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { buildDebriefPrompt, DEBRIEF_SYSTEM_PROMPT, debriefSchema } from "@/lib/debrief";
import { enforce } from "@/lib/rate-limit";
import { projectProfileSchema } from "@/lib/profile";
import { log, errMessage } from "@/lib/log";

const DEBRIEF_MODEL =
  process.env.GROQ_DEBRIEF_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

// Validate client-supplied input against the same schemas that produced it,
// rather than trusting whatever shape the request carries. A malformed profile
// or transcript should fail fast with a 400, not waste a Groq call or feed
// garbage into the prompt.
const conversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  )
  .min(1);

const debriefRequestSchema = z.object({
  profile: projectProfileSchema,
  conversation: conversationSchema,
  hintsUsed: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const limited = await enforce(req, "debrief", 10);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = debriefRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Missing or malformed profile/conversation" }, { status: 400 });
  }
  const { profile, conversation, hintsUsed = 0 } = parsed.data;

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
      log.error("debrief.generate_failed", {
        model: DEBRIEF_MODEL,
        attempt: attempt + 1,
        error: errMessage(err),
      });
    }
  }
  return Response.json({ error: "Debrief generation failed" }, { status: 502 });
}
