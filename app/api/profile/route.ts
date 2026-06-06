import { generateObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextRequest } from "next/server";
import {
  projectProfileSchema,
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "@/lib/profile";
import { enforce } from "@/lib/rate-limit";
import type { RepoContext } from "@/lib/types";

// Structured output needs a Groq model that supports json_schema. llama-3.3-70b
// does not; llama-4-scout does and has a high TPM ceiling for large repo prompts.
const PROFILE_MODEL =
  process.env.GROQ_PROFILE_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

export async function POST(req: NextRequest) {
  const limited = await enforce(req, "profile", 12);
  if (limited) return limited;

  let context: RepoContext;
  try {
    context = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!context.owner || !context.repo) {
    return Response.json({ error: "Missing repo context" }, { status: 400 });
  }

  // generateObject guarantees a schema-valid ProjectProfile or throws — no
  // markdown-fence stripping or hand-rolled JSON parsing on the client. Groq's
  // strict json_schema occasionally rejects a bad generation, so retry once.
  const groq = createGroq();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: groq(PROFILE_MODEL),
        schema: projectProfileSchema,
        system: ANALYSIS_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(context),
      });
      return Response.json(object);
    } catch (err) {
      console.error(`[profile] attempt ${attempt + 1}`, err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ error: "Profile generation failed" }, { status: 502 });
}
