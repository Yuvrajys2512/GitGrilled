import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { buildDebriefPrompt, DEBRIEF_SYSTEM_PROMPT } from "@/lib/debrief";
import { enforce } from "@/lib/rate-limit";
import type { ProjectProfile } from "@/lib/profile";

const JSON_SHAPE = `
Respond with ONLY a valid JSON object — no markdown fences, no explanation. Shape:
{
  "overallScore": number (1-10),
  "verdict": string,
  "categories": [{ "category": string, "score": number (1-10), "notes": string }],
  "strongAreas": string[],
  "weakAreas": string[],
  "fumbledQuestions": [{ "question": string, "whatWentWrong": string }],
  "studyTopics": string[]
}`;

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

  if (!profile || conversation.length === 0) {
    return Response.json({ error: "Missing profile or conversation" }, { status: 400 });
  }

  const result = streamText({
    model: createGroq()("llama-3.3-70b-versatile"),
    system: DEBRIEF_SYSTEM_PROMPT + JSON_SHAPE,
    prompt: buildDebriefPrompt(profile, conversation),
  });

  return result.toTextStreamResponse();
}
