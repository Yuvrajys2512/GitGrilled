import { streamObject } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextRequest } from "next/server";
import {
  projectProfileSchema,
  buildAnalysisPrompt,
  ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/profile";
import type { RepoContext } from "@/lib/types";

export async function POST(req: NextRequest) {
  let context: RepoContext;

  try {
    context = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!context.owner || !context.repo) {
    return Response.json({ error: "Missing repo context" }, { status: 400 });
  }

  const result = streamObject({
    model: createGroq()("llama-3.3-70b-versatile"),
    schema: projectProfileSchema,
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: buildAnalysisPrompt(context),
  });

  return result.toTextStreamResponse();
}
