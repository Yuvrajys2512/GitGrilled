import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextRequest } from "next/server";
import { buildAnalysisPrompt, ANALYSIS_SYSTEM_PROMPT } from "@/lib/profile";
import type { RepoContext } from "@/lib/types";

const JSON_SHAPE = `
Respond with ONLY a valid JSON object — no markdown fences, no explanation. Shape:
{
  "stack": { "language": string, "framework": string|null, "keyLibraries": string[], "databases": string[], "infrastructure": string[] },
  "architecture": { "pattern": string, "description": string, "keyModules": [{ "name": string, "purpose": string }] },
  "notableDecisions": [{ "decision": string, "implication": string }],
  "weakSpots": string[],
  "probeAreas": [{ "topic": string, "angle": string, "difficulty": "medium"|"hard"|"brutal", "sampleQuestion": string }],
  "summary": string
}`;

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

  const result = streamText({
    model: createGroq()("llama-3.3-70b-versatile"),
    system: ANALYSIS_SYSTEM_PROMPT + JSON_SHAPE,
    prompt: buildAnalysisPrompt(context),
  });

  return result.toTextStreamResponse();
}
